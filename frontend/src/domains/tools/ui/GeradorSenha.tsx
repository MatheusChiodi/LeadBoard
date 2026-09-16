import { useState } from 'react'

import { Field, Input } from '../../../design-system/components/Field'
import { GeneratorTool } from '../components/GeneratorTool'
import { generatePassword, type PasswordOptions } from '../lib/generators'

/** Só as chaves booleanas de `PasswordOptions`: `length` é slider, não caixa. */
type ConjuntoChave = Exclude<keyof PasswordOptions, 'length'>

const CONJUNTOS: Array<{ chave: ConjuntoChave; rotulo: string }> = [
  { chave: 'lowercase', rotulo: 'Minúsculas (a-z)' },
  { chave: 'uppercase', rotulo: 'Maiúsculas (A-Z)' },
  { chave: 'digits', rotulo: 'Números (0-9)' },
  { chave: 'symbols', rotulo: 'Símbolos (!@#…)' },
]

export default function GeradorSenha() {
  const [length, setLength] = useState(16)
  const [conjuntos, setConjuntos] = useState({
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
  })

  return (
    <GeneratorTool
      title="Gerador de Senhas"
      description="Gera senhas com o gerador criptográfico do navegador, garantindo ao menos um caractere de cada conjunto escolhido."
      actionLabel="Gerar senhas"
      batch={5}
      generate={() => generatePassword({ length, ...conjuntos })}
      options={
        <>
          <Field
            label={`Comprimento: ${length}`}
            hint="Entre 4 e 128 caracteres."
          >
            <Input
              type="range"
              min={4}
              max={128}
              value={length}
              onChange={(evento) => setLength(Number(evento.target.value))}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text">Conjuntos de caracteres</legend>
            {CONJUNTOS.map(({ chave, rotulo }) => (
              <label key={chave} className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={conjuntos[chave] === true}
                  onChange={(evento) =>
                    setConjuntos((atual) => ({ ...atual, [chave]: evento.target.checked }))
                  }
                  className="size-4 accent-accent"
                />
                {rotulo}
              </label>
            ))}
          </fieldset>
        </>
      }
    />
  )
}
