import { describe, it, expect } from 'vitest';
import { parseAIJsonArray } from '../src/services/geminiService';

describe('parseAIJsonArray', () => {
  it('parseia um array puro', () => {
    expect(parseAIJsonArray<string>('["a","b","c"]', 'teste')).toEqual(['a', 'b', 'c']);
  });

  it('parseia JSON cercado por ```json', () => {
    const text = '```json\n["a","b"]\n```';
    expect(parseAIJsonArray<string>(text, 'teste')).toEqual(['a', 'b']);
  });

  it('coage um objeto único para array de um item', () => {
    const result = parseAIJsonArray<{ title: string }>('{"title":"x"}', 'teste');
    expect(result).toEqual([{ title: 'x' }]);
  });

  it('extrai o array quando há texto ao redor', () => {
    const text = 'Aqui está:\n["a","b"]\nObrigado!';
    expect(parseAIJsonArray<string>(text, 'teste')).toEqual(['a', 'b']);
  });

  it('lança erro rotulado em lixo', () => {
    expect(() => parseAIJsonArray('isso não é json', 'ângulos')).toThrowError(/ângulos/);
  });
});
