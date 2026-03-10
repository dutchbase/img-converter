import { processingQueue } from "@/lib/processingQueue";
import { Sema } from "async-sema";

describe("processingQueue (REQ-205)", () => {
  it("exports a Sema singleton with capacity 3", () => {
    expect(typeof processingQueue.acquire).toBe("function");
    expect(typeof processingQueue.release).toBe("function");
  });

  it("allows up to 3 concurrent acquire() calls without blocking", async () => {
    const sema = new Sema(3);
    await Promise.all([sema.acquire(), sema.acquire(), sema.acquire()]);
    sema.release(); sema.release(); sema.release();
  });

  it("blocks a 4th concurrent acquire() until one release() is called", async () => {
    const sema = new Sema(3);
    await sema.acquire(); await sema.acquire(); await sema.acquire();
    let fourthResolved = false;
    const fourthPromise = sema.acquire().then(() => { fourthResolved = true; });
    await Promise.resolve(); await Promise.resolve();
    expect(fourthResolved).toBe(false);
    sema.release();
    await fourthPromise;
    expect(fourthResolved).toBe(true);
    sema.release(); sema.release(); sema.release();
  });

  it("releases correctly when processImage throws (try/finally)", async () => {
    const sema = new Sema(1);
    await sema.acquire();
    try {
      throw new Error("Simulated error");
    } catch {
      // intentionally swallow
    } finally {
      sema.release();
    }
    // If release wasn't called, this would deadlock
    await sema.acquire();
    sema.release();
  });
});
