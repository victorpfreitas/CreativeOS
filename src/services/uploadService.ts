export async function uploadImageToStorage(file: File): Promise<string> {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY as string | undefined;
  if (!apiKey) throw new Error('A chave da API do ImgBB não está configurada (VITE_IMGBB_API_KEY).');

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Falha ao fazer upload da imagem.');
  }

  return data.data.url as string;
}
