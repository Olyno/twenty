import { useQuery } from '@apollo/client';
import { useMemo } from 'react';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { ObjectMetadataItemIdentifier } from '@/object-metadata/types/ObjectMetadataItemIdentifier';
import { getRecordsFromRecordConnection } from '@/object-record/cache/utils/getRecordsFromRecordConnection';
import { RecordGqlConnection } from '@/object-record/graphql/types/RecordGqlConnection';
import { RecordGqlOperationFindDuplicatesResult } from '@/object-record/graphql/types/RecordGqlOperationFindDuplicatesResults';
import { useFindDuplicateRecordsByDataQuery } from '@/object-record/hooks/useFindDuplicateRecordsByDataQuery';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getFindDuplicateRecordsQueryResponseField } from '@/object-record/utils/getFindDuplicateRecordsQueryResponseField';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { logError } from '~/utils/logError';

export const useFindDuplicateRecordsByData = <T extends ObjectRecord = ObjectRecord>({
  objectRecords = [],
  objectNameSingular,
  onCompleted,
  skip,
}: ObjectMetadataItemIdentifier & {
  objectRecords: Partial<T>[] | undefined;
  onCompleted?: (data: RecordGqlConnection[]) => void;
  skip?: boolean;
}) => {
  const findDuplicateQueryStateIdentifier = objectNameSingular;

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { findDuplicateRecordsByDataQuery } = useFindDuplicateRecordsByDataQuery({
    objectNameSingular,
  });

  const { enqueueSnackBar } = useSnackBar();

  const queryResponseField = getFindDuplicateRecordsQueryResponseField(
    objectMetadataItem.nameSingular,
  );

  const { data, loading, error } =
    useQuery<RecordGqlOperationFindDuplicatesResult>(
      findDuplicateRecordsByDataQuery,
      {
        skip: !!skip,
        variables: {
          data: objectRecords,
        },
        onCompleted: (data) => {
          onCompleted?.(data[queryResponseField]);
        },
        onError: (error) => {
          logError(
            `useFindDuplicateRecordsByData for "${objectMetadataItem.nameSingular}" error : ` +
              error,
          );
          enqueueSnackBar(`Error finding duplicates:", ${error.message}`, {
            variant: SnackBarVariant.Error,
          });
        },
      },
    );

  const objectResults = data?.[queryResponseField];

  const results = useMemo(
    () =>
      objectResults?.map((result: RecordGqlConnection) => {
        return result
          ? (getRecordsFromRecordConnection({
              recordConnection: result,
            }) as T[])
          : [];
      }),
    [objectResults],
  );

  return {
    objectMetadataItem,
    results,
    loading,
    error,
    queryStateIdentifier: findDuplicateQueryStateIdentifier,
  };
};
