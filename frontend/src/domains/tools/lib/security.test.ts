import { describe, expect, it } from 'vitest'

import {
  decodeJwt,
  generateCreditCard,
  isValidLuhn,
  md5,
  sha256,
} from './security'

describe('md5', () => {
  it('bate com o vetor de teste da RFC 1321', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('trata UTF-8', () => {
    expect(md5('ação')).toHaveLength(32)
  })
})

describe('sha256', () => {
  it('bate com o vetor de teste conhecido', async () => {
    await expect(sha256('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('hash de string vazia', async () => {
    await expect(sha256('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('trata UTF-8 sem truncar', async () => {
    await expect(sha256('ação')).resolves.toHaveLength(64)
  })
})

describe('decodeJwt', () => {
  // Token de exemplo público da documentação do jwt.io — não é credencial.
  const TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
    'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

  it('lê o cabeçalho', () => {
    expect(decodeJwt(TOKEN).header).toEqual({ alg: 'HS256', typ: 'JWT' })
  })

  it('lê o payload', () => {
    expect(decodeJwt(TOKEN).payload).toMatchObject({ sub: '1234567890', name: 'John Doe' })
  })

  it('devolve a assinatura sem tentar verificá-la', () => {
    // Verificar exigiria o segredo, que não existe no navegador. Dizer
    // "válido" sem conferir a assinatura seria pior que não dizer nada.
    const { signature, verified } = decodeJwt(TOKEN)
    expect(signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
    expect(verified).toBe(false)
  })

  it('converte as datas de epoch para ISO', () => {
    expect(decodeJwt(TOKEN).issuedAt?.toISOString()).toBe('2018-01-18T01:30:22.000Z')
  })

  it('reporta expiração quando o exp já passou', () => {
    const expirado = montarToken({ exp: 1000 })
    expect(decodeJwt(expirado).expired).toBe(true)
  })

  it('reporta não expirado quando o exp está no futuro', () => {
    const futuro = montarToken({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(decodeJwt(futuro).expired).toBe(false)
  })

  it('não reporta expiração quando não há exp', () => {
    expect(decodeJwt(TOKEN).expired).toBeUndefined()
  })

  it('decodifica base64url com - e _', () => {
    // base64url troca +/ por -_ e tira o padding; usar atob direto falha.
    const token = montarToken({ dado: 'aa?~aa' })
    expect(decodeJwt(token).payload).toMatchObject({ dado: 'aa?~aa' })
  })

  it('recusa token sem três partes', () => {
    expect(() => decodeJwt('a.b')).toThrow(/três partes/i)
  })

  it('recusa token com payload ilegível', () => {
    expect(() => decodeJwt('aaa.!!!.ccc')).toThrow(/jwt/i)
  })
})

function montarToken(payload: Record<string, unknown>): string {
  const b64 = (valor: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(valor))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.assinatura`
}

describe('isValidLuhn', () => {
  it('aceita números de teste conhecidos', () => {
    expect(isValidLuhn('4532015112830366')).toBe(true)
    expect(isValidLuhn('4111111111111111')).toBe(true)
  })

  it('aceita com espaços e hífens', () => {
    expect(isValidLuhn('4111 1111-1111 1111')).toBe(true)
  })

  it('recusa dígito trocado', () => {
    expect(isValidLuhn('4111111111111112')).toBe(false)
  })

  it('recusa entrada não numérica', () => {
    expect(isValidLuhn('abcd')).toBe(false)
  })

  it('recusa string vazia', () => {
    expect(isValidLuhn('')).toBe(false)
  })
})

describe('generateCreditCard', () => {
  it('gera número que passa no Luhn', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isValidLuhn(generateCreditCard().number)).toBe(true)
    }
  })

  it('respeita a bandeira pedida', () => {
    expect(generateCreditCard({ brand: 'visa' }).number).toMatch(/^4/)
    expect(generateCreditCard({ brand: 'mastercard' }).number).toMatch(/^5[1-5]/)
    expect(generateCreditCard({ brand: 'amex' }).number).toMatch(/^3[47]/)
  })

  it('respeita o comprimento da bandeira', () => {
    expect(generateCreditCard({ brand: 'visa' }).number).toHaveLength(16)
    expect(generateCreditCard({ brand: 'amex' }).number).toHaveLength(15)
  })

  it('gera CVV do tamanho certo por bandeira', () => {
    expect(generateCreditCard({ brand: 'visa' }).cvv).toHaveLength(3)
    expect(generateCreditCard({ brand: 'amex' }).cvv).toHaveLength(4)
  })

  it('gera validade no futuro', () => {
    const { expiry } = generateCreditCard()
    const [mes, ano] = expiry.split('/').map(Number)
    expect(mes).toBeGreaterThanOrEqual(1)
    expect(mes).toBeLessThanOrEqual(12)
    expect(2000 + ano).toBeGreaterThanOrEqual(new Date().getFullYear())
  })

  it('aplica máscara quando pedido', () => {
    expect(generateCreditCard({ brand: 'visa', masked: true }).number).toMatch(
      /^\d{4} \d{4} \d{4} \d{4}$/,
    )
  })
})
