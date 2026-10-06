export class WebModelStorage {
  private static STORAGE_KEY = "nasuki_model_cache";

  static async isModelStored(filename: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.storage || !navigator.storage.getDirectory) {
      // Fallback to IndexedDB check or just return false
      return false;
    }

    try {
      const root = await navigator.storage.getDirectory();
      await root.getFileHandle(filename);
      return true;
    } catch (e) {
      return false;
    }
  }

  static async getModelFile(filename: string): Promise<File | null> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(filename);
      return await fileHandle.getFile();
    } catch (e) {
      return null;
    }
  }

  static async saveModel(filename: string, data: ReadableStream, onProgress?: (p: number) => void, totalSize?: number): Promise<void> {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error("STORAGE_UNAVAILABLE");
    }

    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();

    const reader = data.getReader();
    let downloaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await writable.write(value);
      downloaded += value.length;
      if (onProgress && totalSize) {
        onProgress(downloaded / totalSize);
      }
    }

    await writable.close();
  }

  static async removeModel(filename: string): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(filename);
    } catch (e) {}
  }
}
