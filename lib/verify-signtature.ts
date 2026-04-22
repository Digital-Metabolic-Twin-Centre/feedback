import type SignatureCanvas from "react-signature-canvas";

export function isFakeSignature(sigRef: React.RefObject<SignatureCanvas>): boolean {
  if (!sigRef.current) return true;
  if (sigRef.current.isEmpty()) return true;

  const strokes = sigRef.current.toData();
  if (strokes.length === 0) return true;

  // Count total points
  const totalPoints = strokes.reduce((sum, stroke) => sum + stroke.length, 0);

  // Bounding box
  const allPoints = strokes.flatMap((s) => s);
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  // Heuristics: very few points OR very tiny bounding box
  if (totalPoints < 5) return true;
  if (width < 10 && height < 10) return true;

  return false;
}
