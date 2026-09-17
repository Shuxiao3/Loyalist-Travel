import config from '@payload-config'
import { getPayload } from 'payload'

// getPayload caches the instance per process; calling it per request is fine.
export const getPayloadClient = () => getPayload({ config })
