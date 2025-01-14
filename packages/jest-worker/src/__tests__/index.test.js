/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

let Farm;
let WorkerPool;
let Queue;

beforeEach(() => {
  jest.mock('../Farm', () => {
    const fakeClass = jest.fn(() => ({
      doWork: jest.fn().mockResolvedValue(42),
    }));

    return {
      __esModule: true,
      default: fakeClass,
    };
  });

  jest.mock('../WorkerPool', () => {
    const fakeWorker = jest.fn(() => ({
      createWorker: jest.fn(),
      end: jest.fn(),
      getStderr: () => jest.fn(a => a),
      getStdout: () => jest.fn(a => a),
      send: jest.fn(),
    }));

    return {
      __esModule: true,
      default: fakeWorker,
    };
  });

  jest.mock(
    '/fake-worker.js',
    () => ({
      _shouldNotExist1() {},
      methodA() {},
      methodB() {},
    }),
    {virtual: true},
  );

  jest.mock('/fake-worker-with-default-method.js', () => () => {}, {
    virtual: true,
  });

  Farm = require('..').Worker;
  Queue = require('../Farm').default;
  WorkerPool = require('../WorkerPool').default;
});

afterEach(() => {
  jest.resetModules();
});

it('makes a non-existing relative worker throw', () => {
  expect(() => {
    // eslint-disable-next-line no-new
    new Farm('./relative/worker-module.js');
  }).toThrow("'workerPath' must be absolute");
});

it('exposes the right API using default working', () => {
  const farm = new Farm('/tmp/baz.js', {
    exposedMethods: ['foo', 'bar'],
    numWorkers: 4,
  });

  expect(typeof farm.foo).toBe('function');
  expect(typeof farm.bar).toBe('function');
});

it('exposes the right API using passed worker', () => {
  const WorkerPool = jest.fn(() => ({
    createWorker: jest.fn(),
    end: jest.fn(),
    getStderr: () => jest.fn(a => a),
    getStdout: () => jest.fn(a => a),
    send: jest.fn(),
  }));

  const farm = new Farm('/tmp/baz.js', {
    WorkerPool,
    exposedMethods: ['foo', 'bar'],
    numWorkers: 4,
  });

  expect(typeof farm.foo).toBe('function');
  expect(typeof farm.bar).toBe('function');
});

it('breaks if any of the forbidden methods is tried to be exposed', () => {
  expect(
    () => new Farm('/tmp/baz.js', {exposedMethods: ['getStdout']}),
  ).toThrow('Cannot define a method called getStdout');

  expect(
    () => new Farm('/tmp/baz.js', {exposedMethods: ['getStderr']}),
  ).toThrow('Cannot define a method called getStderr');

  expect(() => new Farm('/tmp/baz.js', {exposedMethods: ['end']})).toThrow(
    'Cannot define a method called end',
  );
});

it('works with minimal options', () => {
  const farm1 = new Farm('/fake-worker.js');

  expect(Queue).toHaveBeenCalledTimes(1);
  expect(WorkerPool).toHaveBeenCalledTimes(1);
  expect(typeof farm1.methodA).toBe('function');
  expect(typeof farm1.methodB).toBe('function');
  expect(typeof farm1._shouldNotExist).not.toBe('function');

  const farm2 = new Farm('/fake-worker-with-default-method.js');

  expect(typeof farm2.default).toBe('function');
});

it('does not let make calls after the farm is ended', () => {
  const farm = new Farm('/tmp/baz.js', {
    exposedMethods: ['foo', 'bar'],
    numWorkers: 4,
  });

  farm.end();

  expect(farm._workerPool.end).toHaveBeenCalledTimes(1);
  expect(() => farm.foo()).toThrow(
    'Farm is ended, no more calls can be done to it',
  );
  expect(() => farm.bar()).toThrow(
    'Farm is ended, no more calls can be done to it',
  );
});

it('does not let end the farm after it is ended', async () => {
  const farm = new Farm('/tmp/baz.js', {
    exposedMethods: ['foo', 'bar'],
    numWorkers: 4,
  });

  farm.end();
  expect(farm._workerPool.end).toHaveBeenCalledTimes(1);
  await expect(farm.end()).rejects.toThrow(
    'Farm is ended, no more calls can be done to it',
  );
  await expect(farm.end()).rejects.toThrow(
    'Farm is ended, no more calls can be done to it',
  );
  expect(farm._workerPool.end).toHaveBeenCalledTimes(1);
});

it('calls doWork', async () => {
  const farm = new Farm('/tmp/baz.js', {
    exposedMethods: ['foo', 'bar'],
    numWorkers: 1,
  });

  const promise = farm.foo('car', 'plane');

  expect(await promise).toBe(42);
});

it('calls getStderr and getStdout from worker', async () => {
  const farm = new Farm('/tmp/baz.js', {
    exposedMethods: ['foo', 'bar'],
    numWorkers: 1,
  });

  expect(farm.getStderr()('err')).toBe('err');
  expect(farm.getStdout()('out')).toBe('out');
});
