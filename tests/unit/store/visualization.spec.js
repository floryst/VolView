import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import vtkProxyManager from 'vtk.js/Sources/Proxy/Core/ProxyManager';

import viz from '@/src/store/visualization';
/*
import { initialState } from '@/src/store';
import { NO_SELECTION } from '@/src/constants';
import { FileIO } from '@/src/io/io';
import { makeEmptyFile, makeDicomFile } from '@/tests/testUtils';
*/

chai.use(sinonChai);

describe('Visualization module', () => {
  let mod;
  let context;
  let deps;

  beforeEach(() => {
    deps = {
      // allow stubbing, since vtk.js freezes objects
      proxyManager: { ...vtkProxyManager.newInstance() },
    };

    mod = viz(deps);
    context = {
      state: mod.state,
      dispatch: sinon.spy(),
      commit: sinon.spy(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('setSlices', () => {
    beforeEach(() => {
      const rootGetters = {
        layerOrder: [1],
      };
      Object.assign(context, { rootGetters });
      rootGetters.layerOrder.forEach((id) => {
        Object.assign(context.state.pipelines, {
          [id]: {
            transformFilter: {}, // dummy obj
          },
        });
      });
    });

    it('mutation sets with optional params', () => {
      const { setSlices } = mod.mutations;

      setSlices(context.state, { x: 10 });
      expect(context.state.slices).to.deep.equal({ x: 10, y: 0, z: 0 });

      setSlices(context.state, { y: 20 });
      expect(context.state.slices).to.deep.equal({ x: 10, y: 20, z: 0 });

      setSlices(context.state, {});
      expect(context.state.slices).to.deep.equal({ x: 10, y: 20, z: 0 });
    });

    /*
    it('sets the slice on first rep in each 2D view', () => {
      const { setSlices } = mod.actions;

      setSlices(context, { x: 1, y: 2 });
    });
    */
  });
});
