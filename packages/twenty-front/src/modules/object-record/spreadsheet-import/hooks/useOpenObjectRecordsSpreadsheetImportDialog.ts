import { useApolloClient } from '@apollo/client';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useBatchCreateManyRecords } from '@/object-record/hooks/useBatchCreateManyRecords';
import { useFindDuplicateRecordsByDataQuery } from '@/object-record/hooks/useFindDuplicateRecordsByDataQuery';
import { useBuildAvailableFieldsForImport } from '@/object-record/spreadsheet-import/hooks/useBuildAvailableFieldsForImport';
import { buildRecordFromImportedStructuredRow } from '@/object-record/spreadsheet-import/utils/buildRecordFromImportedStructuredRow';
import { spreadsheetImportFilterAvailableFieldMetadataItems } from '@/object-record/spreadsheet-import/utils/spreadsheetImportFilterAvailableFieldMetadataItems.ts';
import { spreadsheetImportGetUnicityRowHook } from '@/object-record/spreadsheet-import/utils/spreadsheetImportGetUnicityRowHook';
import { SpreadsheetImportCreateRecordsBatchSize } from '@/spreadsheet-import/constants/SpreadsheetImportCreateRecordsBatchSize';
import { useOpenSpreadsheetImportDialog } from '@/spreadsheet-import/hooks/useOpenSpreadsheetImportDialog';
import { spreadsheetImportCreatedRecordsProgressState } from '@/spreadsheet-import/states/spreadsheetImportCreatedRecordsProgressState';
import { SpreadsheetImportDialogOptions } from '@/spreadsheet-import/types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { getFindDuplicateRecordsQueryResponseField } from '@/object-record/utils/getFindDuplicateRecordsQueryResponseField';
import { useSetRecoilState } from 'recoil';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export const useOpenObjectRecordsSpreadsheetImportDialog = (
  objectNameSingular: string,
) => {
  const { openSpreadsheetImportDialog } = useOpenSpreadsheetImportDialog<any>();
  const { enqueueSnackBar } = useSnackBar();

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const setCreatedRecordsProgress = useSetRecoilState(
    spreadsheetImportCreatedRecordsProgressState,
  );

  const abortController = new AbortController();

  const { batchCreateManyRecords } = useBatchCreateManyRecords({
    objectNameSingular,
    mutationBatchSize: SpreadsheetImportCreateRecordsBatchSize,
    setBatchedRecordsCount: setCreatedRecordsProgress,
    abortController,
  });

  const { buildAvailableFieldsForImport } = useBuildAvailableFieldsForImport();
  const apolloClient = useApolloClient();
  const { findDuplicateRecordsByDataQuery } = useFindDuplicateRecordsByDataQuery({
    objectNameSingular,
  });

  const openObjectRecordsSpreadsheetImportDialog = (
    options?: Omit<
      SpreadsheetImportDialogOptions<any>,
      'fields' | 'isOpen' | 'onClose'
    >,
  ) => {
    //All fields that can be imported (included matchable and auto-filled)
    const availableFieldMetadataItemsToImport =
      spreadsheetImportFilterAvailableFieldMetadataItems(
        objectMetadataItem.fields,
      );

    const availableFieldMetadataItemsForMatching =
      availableFieldMetadataItemsToImport.filter(
        (fieldMetadataItem) =>
          fieldMetadataItem.type !== FieldMetadataType.ACTOR,
      );

    const availableFieldsForMatching = buildAvailableFieldsForImport(
      availableFieldMetadataItemsForMatching,
    );

    openSpreadsheetImportDialog({
      ...options,
      onSubmit: async (data) => {
        const createInputs = data.validStructuredRows.map((record) => {
          const fieldMapping: Record<string, any> =
            buildRecordFromImportedStructuredRow({
              importedStructuredRow: record,
              fields: availableFieldMetadataItemsToImport,
            });

          return fieldMapping;
        });

        try {
          const duplicateResult = await apolloClient.query({
            query: findDuplicateRecordsByDataQuery,
            variables: { data: createInputs },
            fetchPolicy: 'no-cache',
          });

          const duplicatesConnections = duplicateResult.data[
            getFindDuplicateRecordsQueryResponseField(objectMetadataItem.nameSingular)
          ];

          const duplicatesCount = duplicatesConnections?.reduce(
            (acc: number, conn: any) => acc + (conn.edges?.length ?? 0),
            0,
          );

          if (duplicatesCount > 0) {
            enqueueSnackBar(
              `${duplicatesCount} possible duplicates detected`,
              { variant: SnackBarVariant.Warning },
            );
          }

          await batchCreateManyRecords({
            recordsToCreate: createInputs,
            upsert: true,
          });
        } catch (error: any) {
          enqueueSnackBar(error?.message || 'Something went wrong', {
            variant: SnackBarVariant.Error,
          });
        }
      },
      fields: availableFieldsForMatching,
      availableFieldMetadataItems: availableFieldMetadataItemsToImport,
      onAbortSubmit: () => {
        abortController.abort();
      },
      rowHook: spreadsheetImportGetUnicityRowHook(objectMetadataItem),
    });
  };

  return {
    openObjectRecordsSpreadsheetImportDialog,
  };
};
