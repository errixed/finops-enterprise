
import {
    findAllWorkflowActors,
    searchWorkflowActors
} from "../repositories/workflow-actor.repository.js";

import {
    parsePagination
} from "../utils/pagination.js";

export async function listWorkflowActors(query = {}) {
    const paginated =
        query.page !== undefined ||
        query.pageSize !== undefined;

    if (!paginated) {
        return findAllWorkflowActors();
    }

    const pagination = parsePagination(
        query.page,
        query.pageSize
    );

    return searchWorkflowActors(pagination);
}