import gql from 'graphql-tag';
import { useRecoilValue } from 'recoil';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { isAggregationEnabled } from '@/object-metadata/utils/isAggregationEnabled';
import { mapObjectMetadataToGraphQLQuery } from '@/object-metadata/utils/mapObjectMetadataToGraphQLQuery';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { getFindDuplicateRecordsQueryResponseField } from '@/object-record/utils/getFindDuplicateRecordsQueryResponseField';
import { capitalize } from 'twenty-shared/utils';

export const useFindDuplicateRecordsByDataQuery = ({
  objectNameSingular,
}: {
  objectNameSingular: string;
}) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();

  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);

  const capitalizedObjectName = capitalize(objectMetadataItem.nameSingular);

  const findDuplicateRecordsByDataQuery = gql`
    query FindDuplicate${capitalizedObjectName}FromData($data: [${capitalizedObjectName}CreateInput!]!) {
      ${getFindDuplicateRecordsQueryResponseField(objectMetadataItem.nameSingular)}(data: $data) {
        edges {
          node ${mapObjectMetadataToGraphQLQuery({
            objectMetadataItems,
            objectMetadataItem,
            objectPermissionsByObjectMetadataId,
          })}
          cursor
        }
        pageInfo {
          ${isAggregationEnabled(objectMetadataItem) ? 'hasNextPage' : ''}
          startCursor
          endCursor
        }
      }
    }
  `;

  return {
    findDuplicateRecordsByDataQuery,
  };
};
