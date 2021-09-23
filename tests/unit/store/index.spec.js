import chai, { expect } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import * as root from '@/src/store/index';
import { Modules, DataTypes } from '@/src/constants';
import { FileIO, FileTypes } from '@/src/io/io';
import { makeEmptyFile, makeDicomFile } from '@/tests/testUtils';

chai.use(chaiAsPromised);
chai.use(sinonChai);

function createModule(fileIO = {}) {
  const actions = root.createActions(fileIO);
  const context = {
    state: root.initialState(),
    commit: sinon.spy(),
    dispatch: sinon.spy(),
  };
  const dispatch = (name, arg) => actions[name](context, arg);
  return {
    actions,
    context,
    dispatch,
  };
}

describe('Store root', () => {
  beforeEach(() => {
    root.GenID.reset();
  });

  describe('addDataset', () => {
    it('should add a dataset', async () => {
      const { context, dispatch } = createModule();

      const cases = [[DataTypes.Image, `${Modules.Image}/addImage`]];
      const dataset = {};

      for (let i = 0; i < cases.length; i++) {
        const [type, expectedAction] = cases[i];
        // eslint-disable-next-line no-await-in-loop
        await dispatch('addDataset', { dataset, type });

        expect(
          context.commit.getCall(i).calledWithMatch('mapIDToType', { type })
        ).to.be.true;
        expect(
          context.dispatch
            .getCall(i)
            .calledWithMatch(expectedAction, { dataset })
        ).to.be.true;
      }
    });
  });

  describe('removeDataset', () => {
    it('should delete a dataset', async () => {
      const { context, dispatch } = createModule();

      // populate state
      const id = 1;
      const type = DataTypes.Image;
      context.state.dataTypeByID[id] = type;

      await dispatch('removeDataset', id);

      expect(context.commit).to.have.been.calledWith('removeIDToType', id);
    });
  });

  describe('importFiles', () => {
    it('should separate out DICOM and regular files', async () => {
      const fileList = [
        makeDicomFile('file1.dcm'),
        makeDicomFile('file2.dcm'),
        makeEmptyFile('file3.nrrd'),
      ];

      const getFileTypeStub = sinon.stub();
      fileList.forEach((file) => {
        if (file.name.endsWith('.dcm')) {
          getFileTypeStub.withArgs(file).returns(FileTypes.DICOM);
        } else {
          const ext = file.name.substr(file.name.lastIndexOf('.'));
          getFileTypeStub.withArgs(file).returns(ext.toLowerCase());
        }
      });

      const fileIO = sinon.createStubInstance(FileIO, {
        getFileType: getFileTypeStub,
      });

      const { dispatch } = createModule(fileIO);
      await dispatch('importFiles', fileList);
    });
  });
});
