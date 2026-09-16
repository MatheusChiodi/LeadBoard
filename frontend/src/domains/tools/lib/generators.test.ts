import { describe, expect, it } from 'vitest'

import {
  generateCnpj,
  generateCpf,
  generateLorem,
  generateMacAddress,
  generatePassword,
  generateUuid,
  isValidCnpj,
  isValidCpf,
  slugify,
} from './generators'

describe('generateUuid', () => {
  it('gera no formato UUID v4', () => {
    expect(generateUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('não repete', () => {
    const gerados = new Set(Array.from({ length: 500 }, generateUuid))
    expect(gerados.size).toBe(500)
  })
})

describe('generateCpf', () => {
  it('gera 11 dígitos sem máscara', () => {
    expect(generateCpf()).toMatch(/^\d{11}$/)
  })

  it('aplica máscara quando pedido', () => {
    expect(generateCpf({ masked: true })).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
  })

  it('gera sempre CPF com dígito verificador válido', () => {
    for (let i = 0; i < 300; i += 1) {
      expect(isValidCpf(generateCpf())).toBe(true)
    }
  })
})

describe('isValidCpf', () => {
  it('aceita CPF válido conhecido', () => {
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('aceita com máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(isValidCpf('52998224724')).toBe(false)
  })

  it('recusa tamanho errado', () => {
    expect(isValidCpf('1234567890')).toBe(false)
  })

  it('recusa sequência de dígitos repetidos', () => {
    // 111.111.111-11 passa no cálculo do módulo 11 mas não é CPF válido.
    // O gerador original não tratava esse caso.
    for (const digito of '0123456789') {
      expect(isValidCpf(digito.repeat(11))).toBe(false)
    }
  })
})

describe('generateCnpj', () => {
  it('gera 14 dígitos sem máscara', () => {
    expect(generateCnpj()).toMatch(/^\d{14}$/)
  })

  it('aplica máscara quando pedido', () => {
    expect(generateCnpj({ masked: true })).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
  })

  it('gera sempre CNPJ com dígito verificador válido', () => {
    for (let i = 0; i < 300; i += 1) {
      expect(isValidCnpj(generateCnpj())).toBe(true)
    }
  })
})

describe('isValidCnpj', () => {
  it('aceita CNPJ válido conhecido', () => {
    expect(isValidCnpj('11222333000181')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(isValidCnpj('11222333000182')).toBe(false)
  })

  it('recusa sequência de dígitos repetidos', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })
})

describe('generatePassword', () => {
  it('respeita o comprimento pedido', () => {
    expect(generatePassword({ length: 24 })).toHaveLength(24)
  })

  it('usa só os conjuntos habilitados', () => {
    const senha = generatePassword({
      length: 40,
      lowercase: true,
      uppercase: false,
      digits: false,
      symbols: false,
    })
    expect(senha).toMatch(/^[a-z]+$/)
  })

  it('garante ao menos um caractere de cada conjunto pedido', () => {
    // Sorteio ingênuo pode devolver senha sem nenhum dígito e reprovar na
    // política do sistema que a exigiu.
    for (let i = 0; i < 200; i += 1) {
      const senha = generatePassword({
        length: 8,
        lowercase: true,
        uppercase: true,
        digits: true,
        symbols: true,
      })
      expect(senha).toMatch(/[a-z]/)
      expect(senha).toMatch(/[A-Z]/)
      expect(senha).toMatch(/\d/)
      expect(senha).toMatch(/[^a-zA-Z0-9]/)
    }
  })

  it('recusa comprimento menor que o número de conjuntos exigidos', () => {
    expect(() =>
      generatePassword({ length: 2, lowercase: true, uppercase: true, digits: true }),
    ).toThrow(/comprimento/i)
  })

  it('recusa quando nenhum conjunto foi habilitado', () => {
    expect(() =>
      generatePassword({
        length: 10,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
      }),
    ).toThrow(/conjunto/i)
  })

  it('não repete entre chamadas', () => {
    const geradas = new Set(Array.from({ length: 200 }, () => generatePassword({ length: 16 })))
    expect(geradas.size).toBe(200)
  })
})

describe('generateMacAddress', () => {
  it('gera no formato com dois-pontos', () => {
    expect(generateMacAddress()).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)
  })

  it('aceita separador alternativo', () => {
    expect(generateMacAddress({ separator: '-' })).toMatch(/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/)
  })

  it('gera endereço unicast local por padrão', () => {
    // Bit 0 do primeiro octeto zerado (unicast) e bit 1 ligado (administrado
    // localmente): é o que evita colidir com um OUI real de fabricante.
    for (let i = 0; i < 100; i += 1) {
      const primeiro = Number.parseInt(generateMacAddress().slice(0, 2), 16)
      expect(primeiro & 0b1).toBe(0)
      expect(primeiro & 0b10).toBe(0b10)
    }
  })
})

describe('slugify', () => {
  it('troca espaços por hífen e baixa a caixa', () => {
    expect(slugify('Olá Mundo Cruel')).toBe('ola-mundo-cruel')
  })

  it('remove acentos', () => {
    expect(slugify('Ação é coração')).toBe('acao-e-coracao')
  })

  it('remove pontuação', () => {
    expect(slugify('C++ & C#: um guia!')).toBe('c-c-um-guia')
  })

  it('colapsa hífens repetidos', () => {
    expect(slugify('a   ---   b')).toBe('a-b')
  })

  it('não deixa hífen nas pontas', () => {
    expect(slugify('  -- teste --  ')).toBe('teste')
  })

  it('devolve string vazia para entrada sem letras', () => {
    expect(slugify('!!!')).toBe('')
  })

  it('preserva números', () => {
    expect(slugify('Top 10 dicas')).toBe('top-10-dicas')
  })

  it('aceita ç e ñ', () => {
    expect(slugify('Ñandu e Açaí')).toBe('nandu-e-acai')
  })
})

describe('generateLorem', () => {
  it('gera a quantidade de parágrafos pedida', () => {
    expect(generateLorem({ paragraphs: 3 }).split('\n\n')).toHaveLength(3)
  })

  it('gera a quantidade de palavras pedida', () => {
    expect(generateLorem({ words: 12 }).split(/\s+/)).toHaveLength(12)
  })

  it('começa com a abertura clássica quando pedido', () => {
    expect(generateLorem({ words: 5, classicOpening: true })).toMatch(/^Lorem ipsum dolor sit amet/)
  })

  it('termina cada parágrafo com ponto', () => {
    for (const paragrafo of generateLorem({ paragraphs: 3 }).split('\n\n')) {
      expect(paragrafo.endsWith('.')).toBe(true)
    }
  })
})
