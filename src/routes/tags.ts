import { Router } from "express";
import * as TagsController from "../controllers/tags";

const tagsRouter: Router = Router();

// GET /tags - Get all tags
tagsRouter.get("/tags", TagsController.getAllTags);

// GET /tags/:id - Get a single tag by ID
tagsRouter.get("/tags/:id", TagsController.getTagById);

// POST /tag - Create a new tag
tagsRouter.post("/tag", TagsController.createTag);

// PUT /tag/:id - Update an existing tag
tagsRouter.put("/tag/:id", TagsController.updateTag);

// DELETE /tag/:id - Delete a tag
tagsRouter.delete("/tag/:id", TagsController.deleteTag);

export default tagsRouter;
