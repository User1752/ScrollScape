'use strict';

function formatSseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamJobProgress({ req, res, job, addListener, removeListener, doneData, errorData }) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (line) => {
    res.write(line);
    if (typeof res.flush === 'function') res.flush();
  };

  write(formatSseEvent('progress', { done: job.done, total: job.total, chapter: '' }));

  if (job.status === 'done') {
    write(formatSseEvent('done', doneData(job)));
    res.end();
    return;
  }

  if (job.status === 'error' && typeof errorData === 'function') {
    write(formatSseEvent('error', errorData(job)));
    res.end();
    return;
  }

  addListener(write);
  req.on('close', () => {
    removeListener(write);
  });
}

module.exports = { streamJobProgress };