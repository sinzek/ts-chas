import { factory, makeGuard, property, transformer, type Guard } from '../shared.js';

export interface UrlHelpers {
	/** Restricts to http:// and https:// URLs with valid domain hostnames */
	http: Guard<string, UrlHelpers>;
	/** Restricts to https:// URLs only */
	https: Guard<string, UrlHelpers>;
	/** Alias for .https — reads well in chains */
	secure: Guard<string, UrlHelpers>;
	/** Matches localhost, 127.0.0.1, ::1 */
	local: Guard<string, UrlHelpers>;
	/** Validates that the URL has a query string */
	hasSearch: Guard<string, UrlHelpers>;
	/** Validates that the URL has a hash fragment */
	hasHash: Guard<string, UrlHelpers>;

	/** Filters by hostname regex */
	hostname: (pattern: RegExp) => Guard<string, UrlHelpers>;
	/** Filters by protocol regex (matched against protocol WITHOUT trailing colon) */
	protocol: (pattern: RegExp) => Guard<string, UrlHelpers>;
	/** Filters by pathname regex */
	pathname: (pattern: RegExp) => Guard<string, UrlHelpers>;
	/** Filters by port. If called with no args, validates that a port is present */
	port: (n?: number) => Guard<string, UrlHelpers>;
}

const DOMAIN_RE = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function tryParseUrl(v: string): URL | null {
	try {
		return new URL(v);
	} catch {
		return null;
	}
}

function isValidUrl(v: string, opts?: { hostname?: RegExp; protocol?: RegExp }): boolean {
	const url = tryParseUrl(v);
	if (!url) return false;
	if (opts?.hostname && !opts.hostname.test(url.hostname)) return false;
	if (opts?.protocol && !opts.protocol.test(url.protocol.replace(/:$/, ''))) return false;
	return true;
}

const urlHelpers: UrlHelpers = {
	// --- Property helpers ---

	http: property(
		transformer<string, string, [], UrlHelpers>(target => ({
			fn: (v: unknown): v is string =>
				typeof v === 'string' && target(v) && isValidUrl(v, { protocol: /^https?$/, hostname: DOMAIN_RE }),
			meta: { name: `${target.meta.name}.http` },
		}))
	) as any,

	https: property(
		transformer<string, string, [], UrlHelpers>(target => ({
			fn: (v: unknown): v is string =>
				typeof v === 'string' && target(v) && isValidUrl(v, { protocol: /^https$/, hostname: DOMAIN_RE }),
			meta: { name: `${target.meta.name}.https` },
		}))
	) as any,

	secure: property(
		transformer<string, string, [], UrlHelpers>(target => ({
			fn: (v: unknown): v is string =>
				typeof v === 'string' && target(v) && isValidUrl(v, { protocol: /^https$/, hostname: DOMAIN_RE }),
			meta: { name: `${target.meta.name}.secure` },
		}))
	) as any,

	local: property(
		transformer<string, string, [], UrlHelpers>(target => ({
			fn: (v: unknown): v is string => {
				if (typeof v !== 'string' || !target(v)) return false;
				const url = tryParseUrl(v);
				return url !== null && LOCAL_HOSTS.has(url.hostname);
			},
			meta: { name: `${target.meta.name}.local` },
		}))
	) as any,

	hasSearch: property(
		transformer<string, string, [], UrlHelpers>(target => ({
			fn: (v: unknown): v is string => {
				if (typeof v !== 'string' || !target(v)) return false;
				const url = tryParseUrl(v);
				return url !== null && url.search.length > 0;
			},
			meta: { name: `${target.meta.name}.hasSearch` },
		}))
	) as any,

	hasHash: property(
		transformer<string, string, [], UrlHelpers>(target => ({
			fn: (v: unknown): v is string => {
				if (typeof v !== 'string' || !target(v)) return false;
				const url = tryParseUrl(v);
				return url !== null && url.hash.length > 0;
			},
			meta: { name: `${target.meta.name}.hasHash` },
		}))
	) as any,

	// --- Factory helpers ---

	hostname: factory<[RegExp], any, UrlHelpers>(
		(pattern: RegExp) => (v: unknown) => typeof v === 'string' && isValidUrl(v, { hostname: pattern })
	),

	protocol: factory<[RegExp], any, UrlHelpers>(
		(pattern: RegExp) => (v: unknown) => typeof v === 'string' && isValidUrl(v, { protocol: pattern })
	),

	pathname: factory<[RegExp], any, UrlHelpers>((pattern: RegExp) => (v: unknown) => {
		if (typeof v !== 'string') return false;
		const url = tryParseUrl(v);
		return url !== null && pattern.test(url.pathname);
	}),

	port: factory<[number?], any, UrlHelpers>((n?: number) => (v: unknown) => {
		if (typeof v !== 'string') return false;
		const url = tryParseUrl(v);
		if (!url) return false;
		if (n !== undefined) return url.port === String(n);
		return url.port.length > 0;
	}),
};

export type UrlGuard = Guard<string, UrlHelpers>;

export interface UrlGuardFactory {
	(options?: { hostname?: RegExp; protocol?: RegExp }): UrlGuard;
}

export const UrlGuardFactory: UrlGuardFactory = (options?: { hostname?: RegExp; protocol?: RegExp }) =>
	makeGuard(
		(v: unknown): v is string => typeof v === 'string' && isValidUrl(v, options),
		{
			name: options
				? `url(${[
						options.hostname ? `hostname: ${options.hostname}` : '',
						options.protocol ? `protocol: ${options.protocol}` : '',
					]
						.filter(Boolean)
						.join(', ')})`
				: 'url',
			id: 'URL',
		},
		urlHelpers
	);
