// Model + installed-model metadata. Phase 2 stores metadata ONLY — no
// downloading and no inference (those belong to a later phase).

import { nowIso } from "@/src/utils/misc";
import { getExecutor } from "../client";
import { InstalledModelStatus, ModelStatus } from "../types";

export interface ModelMetaInput {
  id: string;
  name: string;
  description?: string | null;
  version?: string | null;
  sizeMb?: number | null;
  minRamGb?: number | null;
  license?: string | null;
  licenseUrl?: string | null;
  developer?: string | null;
  price?: number;
  currency?: string;
  downloadUrl?: string | null;
  checksum?: string | null;
  status?: ModelStatus;
}

export const ModelRepository = {
  async upsertModel(m: ModelMetaInput): Promise<void> {
    const db = getExecutor();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO models
        (id, name, description, version, size_mb, min_ram_gb, license, license_url,
         developer, price, currency, download_url, checksum, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, description = excluded.description, version = excluded.version,
         size_mb = excluded.size_mb, min_ram_gb = excluded.min_ram_gb, license = excluded.license,
         license_url = excluded.license_url, developer = excluded.developer, price = excluded.price,
         currency = excluded.currency, download_url = excluded.download_url,
         checksum = excluded.checksum, status = excluded.status, updated_at = excluded.updated_at`,
      [
        m.id, m.name, m.description ?? null, m.version ?? null, m.sizeMb ?? null,
        m.minRamGb ?? null, m.license ?? null, m.licenseUrl ?? null, m.developer ?? null,
        m.price ?? 0, m.currency ?? "USD", m.downloadUrl ?? null, m.checksum ?? null,
        m.status ?? "available", now, now,
      ],
    );
  },

  async upsertMany(models: ModelMetaInput[]): Promise<void> {
    const db = getExecutor();
    await db.withTransactionAsync(async () => {
      for (const m of models) await this.upsertModel(m);
    });
  },

  async listModels() {
    return getExecutor().getAllAsync("SELECT * FROM models ORDER BY name ASC");
  },

  async getModel(id: string) {
    return getExecutor().getFirstAsync("SELECT * FROM models WHERE id = ?", [id]);
  },

  async setInstalledStatus(
    modelId: string,
    status: InstalledModelStatus,
    extra: { localPath?: string | null; installedVersion?: string | null; checksum?: string | null } = {},
  ): Promise<void> {
    const db = getExecutor();
    const now = nowIso();
    const installedAt = status === "installed" ? now : null;
    await db.runAsync(
      `INSERT INTO installed_models
        (model_id, local_path, installed_version, status, checksum, installed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(model_id) DO UPDATE SET
         local_path = excluded.local_path, installed_version = excluded.installed_version,
         status = excluded.status, checksum = excluded.checksum,
         installed_at = COALESCE(excluded.installed_at, installed_models.installed_at),
         updated_at = excluded.updated_at`,
      [
        modelId, extra.localPath ?? null, extra.installedVersion ?? null, status,
        extra.checksum ?? null, installedAt, now,
      ],
    );
  },

  async listInstalled() {
    return getExecutor().getAllAsync("SELECT * FROM installed_models");
  },

  async getInstalled(modelId: string) {
    return getExecutor().getFirstAsync("SELECT * FROM installed_models WHERE model_id = ?", [modelId]);
  },
};
