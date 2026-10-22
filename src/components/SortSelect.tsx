'use client'

import type { ChangeEvent } from 'react'

export type SortSelectOption = { value: string; label: string }

// The kit's sort menu for a results line: "Sort" and a select. It belongs to the list's filter
// form (the `form` attribute names it, so it can sit outside that form), and picking an option
// submits the form, keeping the search and filters. Without script the form's own button
// submits the choice. Keyed on the value: a link to the same list (a tab, a filter, Clear) keeps
// this component mounted, and an uncontrolled select would go on showing the old sort.
export function SortSelect({ form, options, value, name = 'sort', className }: { form: string; options: SortSelectOption[]; value?: string; name?: string; className?: string }) {
  const submit = (e: ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit()
  return (
    <label className={className ? `sort ${className}` : 'sort'}>
      Sort
      <select key={value ?? ''} className="select" name={name} form={form} defaultValue={value ?? ''} onChange={submit}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
