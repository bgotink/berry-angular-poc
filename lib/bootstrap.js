const path = require('path');
const pnpapi = require('pnpapi');
const {setResolveHook, ModuleNotFoundException} = require('@angular-devkit/core/node/resolve');

Error.stackTraceLimit = Infinity;

/**
 * Returns a list of all the callers from the resolve() call.
 * @returns {string[]}
 */
function _caller() {
  // see https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  /** @type {{ prepareStackTrace: (x: {}, stack: {}) => {} }} */
  const error = Error;
  const origPrepareStackTrace = error.prepareStackTrace;
  error.prepareStackTrace = (_, stack) => stack;
  /** @type {{ getFileName(): string }[] | undefined} */
  const stack = (new Error()).stack;
  error.prepareStackTrace = origPrepareStackTrace;

  return stack ? stack.map(x => x.getFileName()).filter(x => !!x) : [];
}

setResolveHook(
    /**
     *
     * @param {string} request
     * @param {{paths?: string[]; checkLocal?: boolean; basedir: string}} options
     */
    function resolveHook(request, options) {
      const basePath = options.basedir;

      if (/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[/\\])/.test(request)) {
        let res = path.resolve(basePath, request);
        if (request === '..' || request.endsWith('/')) {
          res += '/';
        }

        const m = resolve(res, options);
        if (m) {
          return m;
        }
      } else {
        const n = resolve(request, options);
        if (n) {
          return n;
        }
      }

      if (options.checkLocal) {
        const callers = _caller();
        for (const caller of callers) {
          const localDir = path.dirname(caller);
          if (localDir !== options.basedir) {
            try {
              return resolveHook(x, {
                ...options,
                checkLocal: false,
                basedir: localDir,
              });
            } catch (e) {
              // Just swap the basePath with the original call one.
              if (!(e instanceof ModuleNotFoundException)) {
                throw e;
              }
            }
          }
        }
      }

      throw new ModuleNotFoundException(request, basePath);

      function resolve(request, options) {
        if (options.resolvePackageJson) {
          try {
            return pnpapi.resolveRequest(path.join(request, 'package.json'), options.basedir);
          } catch (_) {
            // ignore
          }
        }

        if (request.endsWith('/')) {
          try {
            return pnpapi.resolveRequest(path.join(request, 'index'), options.basedir);
          } catch (_) {
            // ignore
          }
        } else {
          try {
            return pnpapi.resolveRequest(request, options.basedir);
          } catch (_) {
            // ignore
          }
        }
      }
    });
