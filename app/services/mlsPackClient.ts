export async function requestMlsPack(imageUrls: string[]) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("imageUrls must be a non-empty array");
  }

  const response = await fetch("/api/mls-pack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ imageUrls })
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || "Failed to create MLS Pack");
  }

  return json.packUrl;
}

