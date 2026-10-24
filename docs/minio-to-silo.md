# MinIO → Silo migration runbook

Status: **prepared, not executed.** The compose change sits on the `ops/minio-to-silo` branch in each repo and is not merged.

## Why

MinIO stopped publishing images:
- Docker Hub deleted `minio/minio` on 11 September 2026.
- quay.io has answered 401 for every tag and digest since 24 September 2026.

Both apps now run from the image cached on the VPS (`pull_policy: never`). That release, `RELEASE.2025-09-07T16-13-09Z`, lacks the fix for CVE-2025-62506, a high-severity privilege escalation. A cache-only image is also lost to any `docker image prune -a`.

Target: [`pgsty/silo`](https://github.com/pgsty/silo), a community fork of MinIO maintained by Pigsty, with a tag for every release. It is pinned by tag and digest:

```
docker.io/pgsty/silo:RELEASE.2026-10-18T00-00-00Z@sha256:2636fc4155d9a7e41ff58cdb65ddd13ba9304e67184e13c25bc5cb34016269d7
```

It drops into the existing service as is:
- **Runs as root:** no `chown` of the volume is needed.
- **Entrypoint:** maps `server …` to `silo server …`, so the existing `command:` works unchanged.
- **Credentials:** reads the same `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`.
- **Tools:** ships `mc`, so MatrixHR's `mc ready local` healthcheck works, plus `curl`.

## Apps

| App | Coolify UUID | Repo / branch | Compose file | Volume in compose | Exposure |
|---|---|---|---|---|---|
| MatrixHR | `x3onx3hgcjmzk6pggf4rwwtj` | Matrix-HR / master | `docker-compose.deploy.yml` | `minio_data` | Internal only (`expose: 9000`) |
| Davago pharmacy | `xo0wnwuoxfitaaji6fa3siv9` | davago / main | `docker-compose.prod.yml` | `minio-data` | S3 port public as `MEDIA_HOST` |

Order: **MatrixHR first** (internal only, lower stakes), then Davago once MatrixHR has run a day without problems. Davago's MinIO is publicly reachable, so it is the one where the CVE matters most: don't leave it for long.

## Rehearsal

I rehearsed this locally on 24 October 2026 with Docker 29.9 and Compose 5.6:
- **Source image:** MinIO `RELEASE.2025-09-07T16-13-09Z` built from its release tag, the same version the VPS runs.
- **Test data:** 200 objects, a versioned bucket with two versions, and a bucket with an anonymous-download policy.

| Step | Result |
|---|---|
| Back up the stopped volume to a tarball | 200 objects → 20 MB `.tgz` |
| Start Silo on the same volume | Healthy. Same 200 objects, same combined SHA-256, both versions, `download` policy kept. Anonymous GET on the public bucket 200, on the private one 403 |
| Rollback A: old image straight on the Silo-touched volume | Healthy, data identical |
| Rollback B: wipe the volume, restore the tarball, old image | Healthy, data identical |

## Before you start (both apps)

You need a shell on the VPS (72.62.66.45), either over SSH or through Coolify → Servers → Terminal.

1. **Save the old image.** It is the only copy left anywhere, and both rollback paths need it. After the migration nothing uses it, so a Docker cleanup can delete it.
   ```sh
   docker save quay.io/minio/minio:latest | gzip > /root/minio-image-RELEASE.2025-09-07.tar.gz
   ```
2. **Find the volume.** Coolify prefixes volume names with the app UUID:
   ```sh
   docker volume ls | grep -E 'x3onx3hgcjmzk6pggf4rwwtj|xo0wnwuoxfitaaji6fa3siv9' | grep -i minio
   ```
3. **Check disk space.** Compare the volume size with the free space:
   ```sh
   docker run --rm -v <VOLUME>:/data:ro mirror.gcr.io/library/busybox:1.37 du -sh /data
   df -h /root
   ```
4. **Turn off Docker cleanup.** In Coolify → Servers → (server) → Docker Cleanup, turn off any scheduled cleanup until both apps are done.
5. **Pick a quiet time.** File uploads and downloads fail for the app while MinIO is stopped. That's about a minute, plus the time to tar the volume.

## Migration (per app)

1. **Stop MinIO.** This gives a consistent backup. Find the container and stop it:
   ```sh
   docker ps --format '{{.Names}}' | grep '^minio-<UUID>'
   docker stop <minio container name>
   ```
2. **Back up the volume:**
   ```sh
   docker run --rm -v <VOLUME>:/data:ro -v /root:/backup mirror.gcr.io/library/busybox:1.37 \
     tar czf /backup/<app>-minio-data-$(date +%F).tgz -C /data .
   ls -lh /root/<app>-minio-data-*.tgz
   ```
3. **Merge the branch.** Merge `ops/minio-to-silo` into the deploy branch (master for MatrixHR, main for Davago). The change swaps the image line for the pinned Silo image and removes `pull_policy: never`.
4. **Redeploy** the app in Coolify. Coolify pulls Silo, rebuilds the app images and recreates the containers on the same volume.
5. **Verify:**
   - The MinIO container shows `pgsty/silo:RELEASE.2026-10-18…`, and for MatrixHR its health is `healthy`.
   - Its log shows `Version: RELEASE.2026-10-18T00-00-00Z` and no `Unable to initialize backend`.
   - In the app, open an existing uploaded file and upload a new one.
     - MatrixHR: an employee document.
     - Davago: a product image on the public site, served by `MEDIA_HOST`, plus a prescription upload.
6. **Keep the backup tarball and the saved image** for at least two weeks.

## Rollback

Use **A** first. Use **B** only if the data looks wrong on Silo.

**A. Back to the old image on the same data.**
1. Revert the branch merge on the deploy branch. That restores `quay.io/minio/minio:latest` with `pull_policy: never`.
2. Make sure the old image is present: `docker image inspect quay.io/minio/minio:latest`. If it's gone, load it: `gunzip -c /root/minio-image-RELEASE.2025-09-07.tar.gz | docker load`.
3. Redeploy in Coolify.

**B. Restore the backup.**
1. Stop the MinIO container.
2. Restore the tarball into the volume:
   ```sh
   docker run --rm -v <VOLUME>:/data -v /root:/backup mirror.gcr.io/library/busybox:1.37 \
     sh -c 'rm -rf /data/* /data/.[!.]* && tar xzf /backup/<app>-minio-data-<date>.tgz -C /data'
   ```
3. Then do rollback A.

Note: B deletes any files uploaded after the backup was taken.

## After

- **Watch** <https://github.com/pgsty/silo/releases> and bump the pinned tag and digest for security releases.
- **Re-enable** Docker cleanup in Coolify once both apps are on Silo and the two-week window has passed.
- **Long-term option:** migrate to RustFS (closest to MinIO) or Garage (lighter, but no versioning or bucket policies). Davago uses an anonymous-download bucket policy, so it would need RustFS.
