import { config } from '../config.js';

// Drops the publisher of a given stream key via nginx-rtmp's rtmp_control
// module. Dropping the publisher makes nginx fire on_publish_done, which runs
// the normal finalize path. Best-effort — never throws.
export async function dropPublisher(streamKey: string): Promise<void> {
  const url = `${config.NGINX_CONTROL_URL}/drop/publisher` +
    `?app=live&name=${encodeURIComponent(streamKey)}`;
  try {
    await fetch(url, { method: 'GET' });
  } catch (err) {
    console.warn({ err, streamKey }, 'nginx dropPublisher failed');
  }
}
