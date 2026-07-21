export type RegistrationUpdateResult = 'up-to-date' | 'updating';

type UpdateFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, 'ok' | 'status'>>;

/** Checks the network copy first so a stale HTTP cache cannot hide a new worker. */
export async function checkRegistrationForUpdate(
  registration: ServiceWorkerRegistration,
  swUrl: string,
  fetcher: UpdateFetcher = fetch
): Promise<RegistrationUpdateResult> {
  if (registration.installing || registration.waiting) return 'updating';

  const response = await fetcher(swUrl, {
    cache: 'no-store',
    headers: { cache: 'no-store', 'cache-control': 'no-cache' }
  });
  if (!response.ok) throw new Error(`Service worker request failed (${response.status})`);

  let updateFound = false;
  const onUpdateFound = () => {
    updateFound = true;
  };
  registration.addEventListener('updatefound', onUpdateFound);
  try {
    await registration.update();
  } finally {
    registration.removeEventListener('updatefound', onUpdateFound);
  }

  return updateFound || registration.installing || registration.waiting
    ? 'updating'
    : 'up-to-date';
}
