import { ILoggerComponent } from '@well-known-components/interfaces'
import { FailedDeployment } from '../ports/failedDeploymentsCache'
import { DeploymentContext } from '../service/Service'
import { deployEntityFromRemoteServer } from '../service/synchronization/deployRemoteEntity'
import { IGNORING_FIX_ERROR } from '../service/validations/server'
import { AppComponents } from '../types'
import { deploymentExists } from './database-queries/deployments-queries'

export async function isEntityDeployed(
  components: Pick<AppComponents, 'deployedEntitiesFilter' | 'database'>,
  entityId: string
) {
  // this condition should be carefully handled:
  // 1) it first uses the bloom filter to know wheter or not an entity may exist or definitely don't exist (.check)
  // 2) then it checks against the DB (deploymentExists)
  return (await components.deployedEntitiesFilter.check(entityId)) && (await deploymentExists(components, entityId))
}

export async function retryFailedDeploymentExecution(
  components: Pick<
    AppComponents,
    | 'metrics'
    | 'staticConfigs'
    | 'fetcher'
    | 'downloadQueue'
    | 'logs'
    | 'deployer'
    | 'contentCluster'
    | 'failedDeploymentsCache'
  >,
  logger: ILoggerComponent.ILogger
): Promise<void> {
  // Get Failed Deployments from local storage
  const failedDeployments: FailedDeployment[] = components.deployer.getAllFailedDeployments()

  // TODO: there may be chances that failed deployments are not part of all catalyst in cluster
  const contentServersUrls = components.contentCluster.getAllServersInCluster()

  // TODO: Implement an exponential backoff for retrying
  for (const failedDeployment of failedDeployments) {
    // Build Deployment from other servers
    const { entityId, entityType, authChain } = failedDeployment
    if (authChain) {
      logger.debug(`Will retry to deploy entity`, { entityId, entityType })
      try {
        await deployEntityFromRemoteServer(
          components,
          entityId,
          entityType,
          authChain,
          contentServersUrls,
          DeploymentContext.FIX_ATTEMPT
        )
      } catch (error) {
        // it failed again, override failed deployment error description
        const errorDescription = error.message + ''

        // TODO [mendez] this condition has no test coverage
        if (!errorDescription.startsWith(IGNORING_FIX_ERROR)) {
          components.failedDeploymentsCache.reportFailure({ ...failedDeployment, errorDescription })
        }

        logger.error(`Failed to fix deployment of entity`, { entityId, entityType, errorDescription })
        logger.error(error)
      }
    } else {
      logger.info(`Can't retry failed deployment. Because it lacks of authChain`, { entityId, entityType })
    }
  }
}
