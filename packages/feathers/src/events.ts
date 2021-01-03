import { EventEmitter } from 'events';
import { HookContext, Service, Application } from './declarations';

// Returns a hook that emits service events. Should always be
// used as the very last hook in the chain
export function eventHook () {
  return function (ctx: HookContext) {
    const { app, service, method, event, type, result } = ctx;

    const eventName = event === null ? event : (app as any).eventMappings[method];
    const isHookEvent = service._hookEvents && service._hookEvents.indexOf(eventName) !== -1;

    // If this event is not being sent yet and we are not in an error hook
    if (eventName && isHookEvent && type !== 'error') {
      const results = Array.isArray(result) ? result : [ result ];

      results.forEach(element => service.emit(eventName, element, ctx));
    }
  };
}

// Mixin that turns a service into a Node event emitter
export function eventMixin (this: Application, service: Service<any>) {
  if (service._serviceEvents) {
    return;
  }

  const app = this;
  // Indicates if the service is already an event emitter
  const isEmitter = typeof service.on === 'function' &&
    typeof service.emit === 'function';

  // If not, mix add EventEmitter functionality
  if (!isEmitter) {
    Object.assign(service, EventEmitter.prototype);
  }

  // Define non-enumerable properties of
  Object.defineProperties(service, {
    // A list of all events that this service sends
    _serviceEvents: {
      value: Array.isArray(service.events) ? service.events.slice() : []
    },

    // A list of events that should be handled through the event hooks
    _hookEvents: {
      value: []
    }
  });

  // `app.eventMappings` has the mapping from method name to event name
  Object.keys(app.eventMappings).forEach(method => {
    const event = app.eventMappings[method];
    const alreadyEmits = service._serviceEvents.indexOf(event) !== -1;

    // Add events for known methods to _serviceEvents and _hookEvents
    // if the service indicated it does not send it itself yet
    if (typeof service[method] === 'function' && !alreadyEmits) {
      service._serviceEvents.push(event);
      service._hookEvents.push(event);
    }
  });
}

export default function () {
  return function (app: any) {
    // Mappings from service method to event name
    Object.assign(app, {
      eventMappings: {
        create: 'created',
        update: 'updated',
        remove: 'removed',
        patch: 'patched'
      }
    });

    // Register the event hook
    // `finally` hooks always run last after `error` and `after` hooks
    app.hooks({ finally: eventHook() });

    // Make the app an event emitter
    Object.assign(app, EventEmitter.prototype);

    app.mixins.push(eventMixin);
  };
}
