import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import { dbErrorMessage } from '@/lib/db'
import { modelLabel, useModels, type Model } from './openrouter'
import { useAssistantSettings, useSaveAssistantSettings, type AssistantSettings } from './settings'

const settingsSchema = z.object({
  key: z.string().trim().max(500, 'Use até 500 caracteres.'),
  freeOnly: z.boolean(),
  model: z.string(),
})
type SettingsFormValues = z.infer<typeof settingsSchema>

type FormProps = {
  /** O que já está salvo; `null` para quem nunca configurou. */
  settings: AssistantSettings | null
  /** Os modelos que aceitam ferramentas; `null` se a lista não pôde ser carregada. */
  models: Model[] | null
}

function SettingsForm({ settings, models }: FormProps) {
  const save = useSaveAssistantSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      key: settings?.openrouter_key ?? '',
      freeOnly: settings?.free_only ?? true,
      model: settings?.model ?? '',
    },
  })
  const freeOnly = useWatch({ control, name: 'freeOnly' })
  const selected = useWatch({ control, name: 'model' })
  const hasKey = useWatch({ control, name: 'key' }).trim() !== ''

  const offered = (models ?? []).filter((model) => !freeOnly || model.free)
  // O modelo salvo continua na lista mesmo que tenha saído do OpenRouter ou a lista não tenha vindo.
  const missing = selected && !offered.some((model) => model.id === selected)

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    setSaved(false)
    try {
      await save.mutateAsync({
        openrouter_key: values.key || null,
        model: values.model || null,
        free_only: values.freeOnly,
      })
      setSaved(true)
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormField
        label="Chave do OpenRouter"
        type="password"
        autoComplete="off"
        placeholder="sk-or-…"
        error={errors.key?.message}
        {...register('key')}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        Crie a chave em openrouter.ai, em Keys. Ela fica salva na sua conta do app e vale em todos os seus aparelhos.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...register('freeOnly', {
            // Ao voltar para só gratuitos, um modelo pago deixa de ser uma escolha válida.
            onChange: (event) => {
              const current = models?.find((model) => model.id === getValues('model'))
              if (event.target.checked && current && !current.free) setValue('model', '')
            },
          })}
        />
        Mostrar só modelos gratuitos
      </label>

      <SelectField label="Modelo" error={errors.model?.message} {...register('model')}>
        <option value="">Escolha…</option>
        {missing && <option value={selected}>{models ? `${selected} (indisponível)` : selected}</option>}
        {offered.map((model) => (
          <option key={model.id} value={model.id}>
            {modelLabel(model)}
          </option>
        ))}
      </SelectField>
      {!models && <ErrorMessage>Não foi possível carregar a lista de modelos. Verifique sua conexão.</ErrorMessage>}
      {!freeOnly && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Modelos pagos são cobrados no crédito da sua chave, direto pelo OpenRouter.
        </p>
      )}

      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
        {settings?.openrouter_key && hasKey && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => {
              setValue('key', '')
              void submit()
            }}
          >
            Remover chave
          </Button>
        )}
      </div>
      {saved && (
        <p role="status" className="text-sm text-primary">
          Configurações salvas.
        </p>
      )}
    </form>
  )
}

/** Seção do Perfil com a chave do OpenRouter e o modelo que o assistente usa. */
export function AssistantSettingsSection() {
  const settings = useAssistantSettings()
  const models = useModels()

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="font-medium">Assistente</h2>
        <p className="text-sm text-muted-foreground">
          O assistente cria lançamentos a partir do que você escreve, usando um modelo de IA do OpenRouter. O que você
          escrever e os nomes das suas contas e categorias são enviados ao OpenRouter e ao provedor do modelo.
        </p>
      </div>
      {settings.isPending || models.isPending ? (
        <LoadingMessage />
      ) : settings.isError ? (
        <ErrorMessage>Não foi possível carregar as configurações. Verifique sua conexão e tente de novo.</ErrorMessage>
      ) : (
        <SettingsForm settings={settings.data} models={models.data ?? null} />
      )}
    </section>
  )
}
