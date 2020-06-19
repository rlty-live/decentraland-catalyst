import { EntityType } from "dcl-catalyst-commons";
import { loadTestEnvironment } from "../E2ETestEnvironment";
import { MetaverseContentService } from "@katalyst/content/service/Service";
import { EntityCombo, deployEntitiesCombo, buildDeployData, buildDeployDataAfterEntity } from "../E2ETestUtils";

/**
 * This test verifies that the active entity and overwrites are calculated correctly, regardless of the order in which the entities where deployed.
 */
describe("Integration - Order Check", () => {

    const P1 = "X1,Y1"
    const P2 = "X2,Y2"
    const P3 = "X3,Y3"
    const P4 = "X4,Y4"
    const type = EntityType.SCENE
    let E1: EntityCombo, E2: EntityCombo, E3: EntityCombo, E4: EntityCombo, E5: EntityCombo

    let allEntities: EntityCombo[]

    const testEnv = loadTestEnvironment()
    let service: MetaverseContentService

    beforeAll(async () => {
        E1 = await buildDeployData([P1])
        E2 = await buildDeployDataAfterEntity(E1, [P2])
        E3 = await buildDeployDataAfterEntity(E2, [P1, P2, P3])
        E4 = await buildDeployDataAfterEntity(E3, [P1, P3, P4])
        E5 = await buildDeployDataAfterEntity(E4, [P2, P4])
        allEntities = [ E1, E2, E3, E4, E5 ]
        allEntities.forEach(({ entity }, idx) => console.log(`E${idx + 1}: ${entity.id}`))
    })

    beforeEach(async () => {
        service = await testEnv.buildService()
    })

    permutator([0, 1, 2, 3, 4])
        .forEach(function(indices) {
            const names = indices.map((idx) => `E${idx + 1}`).join(' -> ')
            it(names, async done =>  {
                const entityCombos = indices.map(idx => allEntities[idx])
                await deployEntitiesCombo(service, ...entityCombos);
                await assertCommitsWhereDoneCorrectly()
                done();
            });
    });

    async function assertCommitsWhereDoneCorrectly() {
        // Assert only E5 is active
        const activeEntities = await service.getEntitiesByPointers(type, [P1, P2, P3, P4])
        expect(activeEntities.length).toEqual(1)
        const activeEntity = activeEntities[0]
        expect(activeEntity.id).toEqual(E5.entity.id)

        // Assert there is no entity on P1 and P3
        const noEntities = await service.getEntitiesByPointers(type, [P1, P3])
        expect(noEntities.length).toEqual(0)

        await assertOverwrittenBy(E1, E3)
        await assertOverwrittenBy(E2, E3)
        await assertOverwrittenBy(E3, E4)
        await assertOverwrittenBy(E4, E5)
        await assertNotOverwritten(E5)
    }

    async function assertOverwrittenBy(overwritten: EntityCombo, overwrittenBy: EntityCombo) {
        const auditInfo = await service.getAuditInfo(overwritten.entity.type, overwritten.entity.id)
        expect(auditInfo?.overwrittenBy).toEqual(overwrittenBy.entity.id)
    }

    async function assertNotOverwritten(entity: EntityCombo) {
        const auditInfo = await service.getAuditInfo(entity.entity.type, entity.entity.id)
        expect(auditInfo?.overwrittenBy).toBeUndefined()
    }

    function permutator<T>(array: Array<T>): Array<Array<T>> {
        let result: Array<Array<T>> = [];

        const permute = (arr:  Array<T>, m:  Array<T> = []) => {
            if (arr.length === 0) {
                result.push(m)
            } else {
                for (let i = 0; i < arr.length; i++) {
                    let curr = arr.slice();
                    let next = curr.splice(i, 1);
                    permute(curr.slice(), m.concat(next))
                }
            }
        }
        permute(array)
        return result;
    }

})