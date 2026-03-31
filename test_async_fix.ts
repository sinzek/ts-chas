class Result<T, E> {
    constructor(public ok: boolean, public value?: T, public error?: E) {}
}

class ResultAsync<T, E> extends Promise<Result<T, E>> {
    constructor(promise: Promise<Result<T, E>>) {
        super((resolve) => {
            promise.then(resolve);
        });
    }

    map<U>(f: (v: T) => U): ResultAsync<U, E> {
        return new ResultAsync(this.then(res => res.ok ? new Result(true, f(res.value!)) : res as any));
    }
}

async function foo(): ResultAsync<number, string> {
    return new ResultAsync(Promise.resolve(new Result(true, 1)));
}

const x = foo();
console.log('x instanceof ResultAsync:', x instanceof ResultAsync);
