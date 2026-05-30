import { describe, it, expect } from 'vitest';
import { parsePublicHttpUrl, isPublicHttpUrl, isBlockedHostname } from '../api/_lib/http-validation';

describe('parsePublicHttpUrl', () => {
  it('aceita http/https publico', () => {
    expect(parsePublicHttpUrl('https://example.com/path')?.toString()).toBe('https://example.com/path');
    expect(parsePublicHttpUrl('http://youtube.com')?.hostname).toBe('youtube.com');
  });

  it('rejeita protocolos nao-http', () => {
    expect(parsePublicHttpUrl('ftp://example.com')).toBeNull();
    expect(parsePublicHttpUrl('file:///etc/passwd')).toBeNull();
    expect(parsePublicHttpUrl('javascript:alert(1)')).toBeNull();
    expect(parsePublicHttpUrl('data:text/html,<script>')).toBeNull();
  });

  it('rejeita valores vazios ou nao-string', () => {
    expect(parsePublicHttpUrl('')).toBeNull();
    expect(parsePublicHttpUrl('   ')).toBeNull();
    expect(parsePublicHttpUrl(undefined)).toBeNull();
    expect(parsePublicHttpUrl(null)).toBeNull();
    expect(parsePublicHttpUrl(123)).toBeNull();
  });

  it('rejeita URLs malformadas', () => {
    expect(parsePublicHttpUrl('not a url')).toBeNull();
    expect(parsePublicHttpUrl('http://')).toBeNull();
  });

  it('respeita o limite de tamanho', () => {
    const longUrl = `https://example.com/${'a'.repeat(5000)}`;
    expect(parsePublicHttpUrl(longUrl)).toBeNull();
    expect(parsePublicHttpUrl(longUrl, { maxLength: 6000 })).not.toBeNull();
  });

  it('bloqueia hosts internos/privados (SSRF)', () => {
    expect(parsePublicHttpUrl('http://localhost:3000')).toBeNull();
    expect(parsePublicHttpUrl('http://127.0.0.1')).toBeNull();
    expect(parsePublicHttpUrl('http://10.0.0.5')).toBeNull();
    expect(parsePublicHttpUrl('http://192.168.1.1')).toBeNull();
    expect(parsePublicHttpUrl('http://172.16.0.1')).toBeNull();
    expect(parsePublicHttpUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(parsePublicHttpUrl('http://[::1]')).toBeNull();
    expect(parsePublicHttpUrl('http://service.internal')).toBeNull();
  });
});

describe('isBlockedHostname', () => {
  it('bloqueia loopback e ranges privados', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('127.0.0.1')).toBe(true);
    expect(isBlockedHostname('0.0.0.0')).toBe(true);
    expect(isBlockedHostname('10.255.255.255')).toBe(true);
    expect(isBlockedHostname('172.31.0.1')).toBe(true);
    expect(isBlockedHostname('192.168.0.1')).toBe(true);
    expect(isBlockedHostname('169.254.0.1')).toBe(true);
    expect(isBlockedHostname('100.64.0.1')).toBe(true);
    expect(isBlockedHostname('box.local')).toBe(true);
  });

  it('permite hosts publicos', () => {
    expect(isBlockedHostname('example.com')).toBe(false);
    expect(isBlockedHostname('8.8.8.8')).toBe(false);
    expect(isBlockedHostname('172.32.0.1')).toBe(false); // fora do /12
    expect(isBlockedHostname('api.imgbb.com')).toBe(false);
  });
});

describe('isPublicHttpUrl', () => {
  it('é um atalho booleano de parsePublicHttpUrl', () => {
    expect(isPublicHttpUrl('https://example.com')).toBe(true);
    expect(isPublicHttpUrl('http://127.0.0.1')).toBe(false);
  });
});
