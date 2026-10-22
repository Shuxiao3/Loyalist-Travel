import { getHeaderMenus } from '@/lib/nav'

import { SiteHeaderNav } from './SiteHeaderNav'

// The site header. The menu stories are read here, on the server; SiteHeaderNav draws the
// header and runs the menus, the phone drawer and the current-section marking.
export async function SiteHeader() {
  const menus = await getHeaderMenus()
  return <SiteHeaderNav menus={menus} />
}
