// Adapter that either calls an external workflow service (if WORKFLOW_SERVICE_URL is set)
// or delegates to the in-process controller implementation.
const WORKFLOW_SERVICE_URL = process.env.WORKFLOW_SERVICE_URL || '';
async function callRemoteCreate(bookingId, steps) {
    try {
        // Use global fetch available in Node 18+ / modern runtimes
        const url = WORKFLOW_SERVICE_URL.replace(/\/$/, '') + '/workflows';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, steps })
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`Workflow service responded ${res.status}: ${txt}`);
        }
        return await res.json();
    }
    catch (err) {
        console.error('callRemoteCreate error', err && err.message ? err.message : err);
        throw err;
    }
}
async function createWorkflowForBooking(bookingId, steps) {
    if (WORKFLOW_SERVICE_URL) {
        try {
            return await callRemoteCreate(bookingId, steps);
        }
        catch (e) {
            // If remote call fails, log and fall back to in-process implementation
            console.warn('Workflow service call failed, falling back to local controller');
        }
    }
    try {
        const local = require('../controllers/serviceWorkflowController');
        if (local && typeof local.createWorkflowForBooking === 'function') {
            return await local.createWorkflowForBooking(bookingId, steps);
        }
    }
    catch (e) {
        console.error('Local workflow controller error', e && e.message ? e.message : e);
        throw e;
    }
}
module.exports = { createWorkflowForBooking };
