
const airtableApiKey = 'patSWDtamQOwCUTma.cf91a64e97b18ab7308fc81ae6ca9712687a5db59d5ad661a615926de6dae133';
const airtableBaseId = 'appXwEBSWkI5b6Hos';
const airtableClassTableName = 'Class';
const airtableInstructorTableName = 'Instructor';

const webflowApiKey = 'ea0ab0b974aa90c38b6a57a61a880d21292d02c8b89c37816871f995666e1c3e';
const webflowCollectionId = '671a8a02594f9dd273e5f9da';

const corsAnywhere = 'https://cors-anywhere.herokuapp.com/';

// Fetch class records from Airtable
async function getAirtableClassRecords() {
  const url = `https://api.airtable.com/v0/${airtableBaseId}/${airtableClassTableName}`;
  console.log('Fetching Class records from:', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${airtableApiKey}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch Class records:', response.status, response.statusText);
    return [];
  }

  const data = await response.json();
  console.log('Received Class records:', data.records);
  return data.records;
}

// Fetch instructor records from Airtable
async function getAirtableInstructorRecords() {
  const url = `https://api.airtable.com/v0/${airtableBaseId}/${airtableInstructorTableName}`;
  console.log('Fetching Instructor records from:', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${airtableApiKey}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch Instructor records:', response.status, response.statusText);
    return [];
  }

  const data = await response.json();
  console.log('Received Instructor records:', data.records);
  return data.records;
}

// Fetch records from Webflow
async function getWebflowRecords() {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items`;
  console.log('Fetching Webflow records from:', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${webflowApiKey}`,
      'accept-version': '1.0.0',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch Webflow records:', response.status, response.statusText);
    return [];
  }

  const data = await response.json();
  console.log('Received Webflow records:', data.items);
  return data.items;
}



// Check for differences between Airtable and Webflow fields
function hasDifferences(airtableFields, webflowFields) {
  return (
    airtableFields.Title !== webflowFields.name ||
    airtableFields.Description !== webflowFields.description ||
    airtableFields['Start date'] !== webflowFields['start-date'] ||
    airtableFields['End date'] !== webflowFields['end-date'] ||
    airtableFields.Location !== webflowFields.location ||
    airtableFields['Created time'] !== webflowFields['start-time'] ||
    airtableFields['End time'] !== webflowFields['end-time'] ||
    JSON.stringify(airtableFields.InstructorNames) !== JSON.stringify(webflowFields['instructor-name'])
  );
}

// Map instructors to class records
function mapInstructors(classRecords, instructorRecords) {
  const instructorMap = instructorRecords.reduce((map, instructor) => {
    map[instructor.id] = instructor.fields;
    return map;
  }, {});

  return classRecords.map(classRecord => {
    const instructors = classRecord.fields.Instructor || [];
    const instructorNames = instructors.map(id => {
      const instructor = instructorMap[id];
      return instructor ? instructor.Name : 'Unknown';
    });

    console.log('Mapping Instructors for Class Record:', classRecord.fields.Title, instructorNames);

    return {
      ...classRecord,
      fields: {
        ...classRecord.fields,
        InstructorNames: instructorNames,
      },
    };
  });
}

// Main function to synchronize Airtable to Webflow
async function syncAirtableToWebflow() {
  const classRecords = await getAirtableClassRecords();
  const instructorRecords = await getAirtableInstructorRecords();

  if (!classRecords.length || !instructorRecords.length) {
    console.log('No class or instructor records found in Airtable.');
    return;
  }

  // Map instructors to class records
  const enhancedClassRecords = mapInstructors(classRecords, instructorRecords);

  // Fetch existing Webflow records and map them by `airtableid`
  const webflowRecords = await getWebflowRecords();
  const webflowItemMap = webflowRecords.reduce((map, item) => {
    if (item && item.fieldData && item.fieldData.airtableid) {
      map[item.fieldData.airtableid] = item; // Map by airtableid
    }
    return map;
  }, {});

  console.log('Webflow Item Map:', webflowItemMap); // Debugging: Log the webflow item map

  // Set of Airtable record IDs
  const airtableRecordIds = new Set(enhancedClassRecords.map(record => record.id));

  // Delete Webflow items that are not found in Airtable
  for (const webflowItem of webflowRecords) {
    const airtableId = webflowItem.fieldData?.airtableid;
    if (airtableId && !airtableRecordIds.has(airtableId)) {
      console.log(`Deleting Webflow item with ID ${webflowItem.id} as it no longer exists in Airtable.`);
      await deleteWebflowItem(webflowItem.id);
    }
  }

  // Process each Airtable record for additions and updates
  for (const classRecord of enhancedClassRecords) {
    const airtableFields = {
      Title: classRecord.fields.Title || '',
      Description: classRecord.fields.Description || '',
      'Start date': classRecord.fields['Start date'] || '',
      'End date': classRecord.fields['End date'] || '',
      Location: classRecord.fields.Location || '',
      'Created time': classRecord.fields['Created time'] || '',
      'End time': classRecord.fields['End time'] || '',
      InstructorNames: classRecord.fields.InstructorNames || [],
      AirtableRecordId: classRecord.id || '', // Use Airtable's record ID as `airtableid`
    };

    const existingWebflowItem = webflowItemMap[airtableFields.AirtableRecordId];

    // Debugging: Log existing item and its ID
    if (existingWebflowItem) {
      const webflowId = existingWebflowItem.id; // Webflow's unique ID for the record
      console.log('Found existing Webflow item:', existingWebflowItem);
      console.log('Webflow ID:', webflowId); // Log the Webflow ID

      // Check for differences or mismatched IDs
      if (hasDifferences(airtableFields, existingWebflowItem.fieldData)) {
        console.log('Updating existing record in Webflow:', airtableFields.Title);
        await updateWebflowItem(webflowCollectionId, webflowId, airtableFields);
      } else {
        console.log('No changes detected for:', airtableFields.Title);
      }
    } else {
      // If the Airtable record does not exist in Webflow, add it as a new record
      console.log('Adding new record to Webflow:', airtableFields.Title);
      await addWebflowItem(airtableFields);
    }
  }
}

// Update Webflow item with specific fields only
async function updateWebflowItem(collectionId, webflowId, fieldsToUpdate) {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items/${webflowId}`;
  console.log('Updating Webflow item with ID:', webflowId);

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json',
        'Origin': 'https://connectmate-new.webflow.io/double-slider',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        fieldData: {
          name: fieldsToUpdate.Title || '',
          slug: fieldsToUpdate.Title ? fieldsToUpdate.Title.toLowerCase().replace(/\s+/g, '-') : '',
          description: fieldsToUpdate.Description || '',
          'end-time': String(fieldsToUpdate['End time'] || ''),
          'start-time': String(fieldsToUpdate['Created time'] || ''),
          location: fieldsToUpdate.Location || '',
          'start-date': fieldsToUpdate['Start date'] || '',
          'end-date': fieldsToUpdate['End date'] || '',
          'instructor-name': fieldsToUpdate.InstructorNames.join(', ') || 'Instructor Unavailable',
          airtableid: fieldsToUpdate.AirtableRecordId,
          _archived: false,
          _draft: false,
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to update Webflow item:', await response.json());
      return null;
    }

    const data = await response.json();
    console.log('Webflow item updated:', data);
    return data;
  } catch (error) {
    console.error('Error while updating data in Webflow:', error);
    return null;
  }
}
// Delete a Webflow item
async function deleteWebflowItem(webflowId) {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items/${webflowId}`;
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${webflowApiKey}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to delete Webflow item:', await response.json());
      return null;
    }

    console.log('Webflow item deleted:', webflowId);
    return true;
  } catch (error) {
    console.error('Error deleting item from Webflow:', error);
    return null;
  }
}

// Add a new item to Webflow
async function addWebflowItem(airtableFields) {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items`;
  console.log('Adding new Webflow item:', airtableFields);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json',
        'Origin': 'https://connectmate-new.webflow.io/double-slider',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        fieldData: {
          name: airtableFields.Title || '',
          slug: airtableFields.Title ? airtableFields.Title.toLowerCase().replace(/\s+/g, '-') : '',
          description: airtableFields.Description || '',
          'end-time': String(airtableFields['End time'] || ''),
          'start-time': String(airtableFields['Created time'] || ''),
          location: airtableFields.Location || '',
          'start-date': airtableFields['Start date'] || '',
          'end-date': airtableFields['End date'] || '',
          'instructor-name': airtableFields.InstructorNames.join(', ') || 'Instructor Unavailable',
          airtableid: airtableFields.AirtableRecordId,
          _archived: false,
          _draft: false,
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to add Webflow item:', await response.json());
      return null;
    }

    const data = await response.json();
    console.log('New Webflow item added:', data);
    return data;
  } catch (error) {
    console.error('Error while adding data to Webflow:', error);
    return null;
  }
}



// Execute the synchronization
syncAirtableToWebflow();
