'use strict';

const os = require('os');

// Periodic sampler for this process's own CPU/RAM/network footprint, meant
// for a lightweight monitoring view (the terminal dashboard) — not
// billing-grade accounting. Two things are deliberately NOT done here:
//
//  - Reading OS-wide network interface counters. Those report traffic for
//    the whole machine, not this process, and would be misleading next to
//    a "ScrollScape resource usage" label.
//  - Per-request Content-Length summation for bytes-out. A gzip'd response
//    body and its Content-Length header can disagree, and HEAD/streamed
//    responses often have no Content-Length at all. Reading the deltas of
//    the underlying socket's own bytesRead/bytesWritten counters (below)
//    reflects what was actually put on the wire for that request, and
//    naturally handles HTTP keep-alive (the same socket serving several
//    requests) because only the delta *during this request* is counted,
//    not the socket's running total.
function createResourceMonitor({ sampleIntervalMs = 2000 } = {}) {
  let totalBytesIn = 0;
  let totalBytesOut = 0;
  let requestCount = 0;

  let lastSampleAt = Date.now();
  let lastCpuUsage = process.cpuUsage();
  let lastBytesIn = 0;
  let lastBytesOut = 0;
  let lastRequestCount = 0;

  let snapshot = {
    cpuPercent: 0,
    network: { bytesInPerSec: 0, bytesOutPerSec: 0, requestsPerSec: 0 },
  };

  function sample() {
    const now = Date.now();
    const elapsedMs = Math.max(1, now - lastSampleAt);

    const cpuDelta = process.cpuUsage(lastCpuUsage); // {user, system} microseconds since lastCpuUsage
    const cpuMicros = cpuDelta.user + cpuDelta.system;
    const cpuPercent = (cpuMicros / (elapsedMs * 1000) / os.cpus().length) * 100;

    const elapsedSec = elapsedMs / 1000;
    snapshot = {
      cpuPercent: Math.max(0, Math.round(cpuPercent * 10) / 10),
      network: {
        bytesInPerSec: Math.round((totalBytesIn - lastBytesIn) / elapsedSec),
        bytesOutPerSec: Math.round((totalBytesOut - lastBytesOut) / elapsedSec),
        requestsPerSec: Math.round(((requestCount - lastRequestCount) / elapsedSec) * 10) / 10,
      },
    };

    lastSampleAt = now;
    lastCpuUsage = process.cpuUsage();
    lastBytesIn = totalBytesIn;
    lastBytesOut = totalBytesOut;
    lastRequestCount = requestCount;
  }

  const timer = setInterval(sample, sampleIntervalMs);
  timer.unref(); // don't hold the process open just for this

  function middleware(req, res, next) {
    const socket = req.socket;
    const startBytesRead = socket ? socket.bytesRead : 0;
    const startBytesWritten = socket ? socket.bytesWritten : 0;

    res.on('finish', () => {
      if (socket && !socket.destroyed) {
        totalBytesIn += Math.max(0, socket.bytesRead - startBytesRead);
        totalBytesOut += Math.max(0, socket.bytesWritten - startBytesWritten);
      }
      requestCount++;
    });

    next();
  }

  function getSnapshot() {
    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.round(process.uptime()),
      cpu: {
        percent: snapshot.cpuPercent,
        cores: os.cpus().length,
      },
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        systemTotalBytes: os.totalmem(),
        systemFreeBytes: os.freemem(),
      },
      network: snapshot.network,
    };
  }

  return { middleware, getSnapshot };
}

module.exports = { createResourceMonitor };
