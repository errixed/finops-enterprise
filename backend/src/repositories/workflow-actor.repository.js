import {
    getCollection
} from "./mongodb.repository.js";

export async function findActiveWorkflowActor(
    actorId,
    session
) {
    return getCollection("workflow_actors").findOne(
        {
            actorId,
            active: true
        },
        { session }
    );
}

export async function findAllWorkflowActors() {
    return getCollection("workflow_actors")
        .find(
            { active: true },
            {
                projection: {
                    _id: 0,
                    actorId: 1,
                    name: 1,
                    role: 1
                }
            }
        )
        .sort({ actorId: 1 })
        .toArray();
}

export async function searchWorkflowActors({
    page,
    pageSize
}) {
    const collection = getCollection("workflow_actors");

    const filter = { active: true };

    const [data, total] = await Promise.all([
        collection
            .find(filter, {
                projection: {
                    _id: 0,
                    actorId: 1,
                    name: 1,
                    role: 1
                }
            })
            .sort({ actorId: 1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray(),
        collection.countDocuments(filter)
    ]);

    return {
        data,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}
