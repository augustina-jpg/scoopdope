import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  SorobanRpc,
  nativeToScVal,
  Address,
} from '@stellar/stellar-sdk';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);
  private readonly sorobanServer: SorobanRpc.Server;
  private readonly networkPassphrase: string;
  private readonly reputationContractId: string;

  constructor(private readonly configService: ConfigService) {
    const isTestnet = this.configService.get<string>('stellar.network') !== 'mainnet';
    this.networkPassphrase = isTestnet ? Networks.TESTNET : Networks.PUBLIC;
    const rpcUrl = this.configService.get<string>('stellar.sorobanRpcUrl') ?? '';
    this.sorobanServer = new SorobanRpc.Server(rpcUrl);
    this.reputationContractId = this.configService.get<string>('stellar.reputationContractId') ?? '';
  }

  /** Read on-chain reputation score for a Stellar public key (read-only simulate) */
  async getReputationScore(stellarPublicKey: string): Promise<string> {
    if (!this.reputationContractId) {
      throw new Error('REPUTATION_CONTRACT_ID not configured');
    }

    const issuerKeypair = Keypair.fromSecret(
      this.configService.get<string>('stellar.secretKey') ?? ''
    );
    const source = await this.sorobanServer.getAccount(issuerKeypair.publicKey());

    const tx = new TransactionBuilder(source as any, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: this.reputationContractId,
          function: 'get_reputation',
          args: [new Address(stellarPublicKey).toScVal()],
        })
      )
      .setTimeout(30)
      .build();

    const simResult = await this.sorobanServer.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Reputation simulation failed: ${simResult.error}`);
    }

    const retVal = (simResult as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    return retVal ? BigInt(retVal.value() as unknown as bigint).toString() : '0';
  }

  /** Update reputation on-chain (admin operation) */
  async updateReputation(
    userPublicKey: string,
    scoreChange: number,
    reason: string,
    courseId?: number,
  ): Promise<string> {
    if (!this.reputationContractId) {
      throw new Error('REPUTATION_CONTRACT_ID not configured');
    }

    const issuerKeypair = Keypair.fromSecret(
      this.configService.get<string>('stellar.secretKey') ?? ''
    );
    const source = await this.sorobanServer.getAccount(issuerKeypair.publicKey());

    const tx = new TransactionBuilder(source as any, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: this.reputationContractId,
          function: 'update_reputation',
          args: [
            new Address(issuerKeypair.publicKey()).toScVal(), // admin
            new Address(userPublicKey).toScVal(),             // user
            nativeToScVal(scoreChange, { type: 'i128' }),
            nativeToScVal(reason, { type: 'symbol' }),
            courseId !== undefined
              ? nativeToScVal({ tag: 'Some', values: [courseId] })
              : nativeToScVal({ tag: 'None', values: undefined }),
          ],
        })
      )
      .setTimeout(30)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    (prepared as any).sign(issuerKeypair);
    const result = await this.sorobanServer.sendTransaction(prepared as any);
    this.logger.log(`update_reputation tx: ${result.hash}`);
    return result.hash;
  }
}
