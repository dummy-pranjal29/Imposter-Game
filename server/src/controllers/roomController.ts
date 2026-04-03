import { Router, Request, Response } from "express";
import { roomManager } from "../managers/RoomManager";

export const roomRouter = Router();

/**
 * POST /api/rooms
 * Create a new room. Returns the roomId and shareable invite link.
 */
roomRouter.post("/", (_req: Request, res: Response) => {
  const room = roomManager.createRoom();
  res.status(201).json({
    roomId: room.roomId,
    inviteUrl: `/room/${room.roomId}`,
  });
});

/**
 * GET /api/rooms/:roomId
 * Validate a room before the client attempts to connect via Socket.IO.
 * Returns public metadata — no game secrets.
 */
roomRouter.get("/:roomId", (req: Request, res: Response): void => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }

  const connectedCount = roomManager.getConnectedPlayers(room).length;

  res.json({
    roomId: room.roomId,
    playerCount: connectedCount,
    maxPlayers: 5,
    isFull: connectedCount >= 5,
    phase: room.game.phase,
    canJoin: connectedCount < 5 && room.game.phase === "LOBBY",
  });
});
