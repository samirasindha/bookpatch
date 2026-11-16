import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { lookupIsbn, searchCatalog } from "../lib/catalog.js";
import { HttpError } from "../lib/errors.js";

export const booksRouter = Router();
booksRouter.use(requireAuth);

booksRouter.get("/search", async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(1).max(200) }).parse(req.query);
  res.json({ results: await searchCatalog(q) });
});

booksRouter.get("/isbn/:isbn", async (req, res) => {
  const book = await lookupIsbn(req.params.isbn);
  if (!book) throw new HttpError(404, "No book found for that ISBN");
  res.json({ book });
});
