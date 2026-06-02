/**
 * Mock for @xenova/transformers in tests
 */

export const env = {
  allowLocalModels: false,
  useBrowserCache: false
};

const mockModel = jest.fn((texts: string | string[], options: any) => {
  const isArray = Array.isArray(texts);
  const count = isArray ? texts.length : 1;
  const dimensions = 1024;
  
  // Generate mock embeddings
  const data = new Float32Array(count * dimensions);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 0.2 + 0.4; // Random values 0.4-0.6
  }
  
  return Promise.resolve({ data });
});

export const pipeline = jest.fn().mockResolvedValue(mockModel);
