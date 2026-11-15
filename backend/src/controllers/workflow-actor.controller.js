import {
    listWorkflowActors
} from "../services/workflow-actor.service.js";

export async function getWorkflowActors(req, res, next) {
    try {
        const actors = await listWorkflowActors(req.query);
        res.status(200).json(actors);
    } catch (error) {
        next(error);
    }
}