// ============================================================
// Made by Human — Pexels Image Search Service
// ============================================================

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || '';
const PEXELS_API_URL = 'https://api.pexels.com/v1';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

export async function searchImages(query: string, page = 1, perPage = 20): Promise<{
  photos: PexelsPhoto[];
  totalResults: number;
}> {
  const response = await fetch(
    `${PEXELS_API_URL}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=portrait`,
    {
      headers: { Authorization: PEXELS_API_KEY },
    }
  );

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`);
  }

  const data: PexelsSearchResponse = await response.json();
  return {
    photos: data.photos,
    totalResults: data.total_results,
  };
}

export async function getCuratedImages(page = 1, perPage = 20): Promise<{
  photos: PexelsPhoto[];
}> {
  const response = await fetch(
    `${PEXELS_API_URL}/curated?page=${page}&per_page=${perPage}`,
    {
      headers: { Authorization: PEXELS_API_KEY },
    }
  );

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`);
  }

  const data: PexelsSearchResponse = await response.json();
  return { photos: data.photos };
}
