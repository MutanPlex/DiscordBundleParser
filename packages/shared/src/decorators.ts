const SYM_UNCACHED = Symbol("uncached");

type CacheTarget = {
    [key: symbol]: typeof SYM_UNCACHED | any;
};

type F<P extends () => any> = (...args: Parameters<P>) => ReturnType<P>;

/**
 * Caches the result of a function and provides an option to invalidate the cache.
 *
 * Only works on methods with no parameters
 *
 * @param invalidate An optional array of functions that a function to invalidate the cache will be pushed to.
 * @returns A decorator function that can be used to cache the result of a method.
 */
export function Cache(invalidate?: (() => void)[]) {
    return function <
        P extends () => any,
    >(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<F<P>>,
    ):
        TypedPropertyDescriptor<F<P>> | void {
        const sym = Symbol(`cache-${propertyKey.toString()}`);

        (target as CacheTarget)[sym] = SYM_UNCACHED;

        type A = Parameters<P>;

        type R = ReturnType<P>;

        const orig = descriptor.value;

        if (typeof orig !== "function") {
            throw new Error("Not a function");
        }
        if (orig.length !== 0) {
            throw new Error("Function has parameters");
        }
        descriptor.value = function (...args: A): R {
            const t = this as CacheTarget;

            if (t[sym] === SYM_UNCACHED) {
                invalidate?.push(() => {
                    t[sym] = SYM_UNCACHED;
                });
                t[sym] = orig.apply(t, args);
            }
            return t[sym];
        };
    };
}
/**
 * Same thing as {@link Cache} but for getters.
 */
export function CacheGetter(invalidate?: (() => void)[]) {
    return function <T>(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<T>,
    ):
        TypedPropertyDescriptor<T> | void {
        const sym = Symbol(`cache-${propertyKey.toString()}`);

        (target as CacheTarget)[sym] = SYM_UNCACHED;

        const orig = descriptor?.get;

        if (typeof orig !== "function") {
            throw new Error("Not a getter");
        }
        descriptor.get = function (): T {
            const t = this as CacheTarget;

            if (t[sym] === SYM_UNCACHED) {
                invalidate?.push(() => {
                    t[sym] = SYM_UNCACHED;
                });
                t[sym] = orig.apply(t);
            }
            return t[sym];
        };
        return descriptor;
    };
}
