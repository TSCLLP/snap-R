"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { requestMlsPack } from "@/app/services/mlsPackClient";

export default function ListingPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // fetch listing + photos
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
            id,
            title,
            address,
            city,
            state,
            postal_code,
            created_at,
            updated_at,
            photos (
              id,
              raw_url,
              processed_url,
              status,
              variant
            )
          `
        )
        .eq("id", params.id)
        .single();

      if (!error) setListing(data);
      setLoading(false);
    }

    load();
  }, [params.id]);

  async function handleDownloadMlsPack() {
    if (!listing?.photos) return alert("No listing photos found");

    const urls = listing.photos
      .map((p: any) => p.processed_url)
      .filter(Boolean);

    if (!urls.length) {
      alert("Photos are not processed yet");
      return;
    }

    try {
      const packUrl = await requestMlsPack(urls);
      window.open(packUrl, "_blank");
    } catch (err: any) {
      alert("Failed to generate MLS pack");
      console.error("MLS pack error:", err);
    }
  }

  if (loading) return <div className="p-6 text-lg">Loading…</div>;
  if (!listing) return <div className="p-6 text-lg">Listing not found</div>;

  return (
    <div className="p-6 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">{listing.title || "Property"}</h1>
          <p className="text-lg text-gray-600">{listing.address}</p>
        </div>

        <button
          onClick={handleDownloadMlsPack}
          className="px-5 py-3 bg-yellow-400 hover:bg-yellow-500 text-black border border-black shadow-md rounded-md text-lg font-bold"
        >
          Download MLS Pack
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {listing.photos?.map((photo: any) => (
          <div key={photo.id} className="space-y-3 border rounded-md p-3 shadow-sm">
            {photo.raw_url && photo.processed_url ? (
              <div className="relative w-full h-64">
                <BeforeAfterSlider before={photo.raw_url} after={photo.processed_url} />
              </div>
            ) : (
              <div className="relative w-full h-64">
                <Image
                  src={photo.processed_url || photo.raw_url}
                  alt="Listing Image"
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <p className="text-sm text-gray-500">Status: {photo.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
