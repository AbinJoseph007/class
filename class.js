
const airtableApiKey = 'patSWDtamQOwCUTma.cf91a64e97b18ab7308fc81ae6ca9712687a5db59d5ad661a615926de6dae133';
const airtableBaseId = 'appXwEBSWkI5b6Hos';
const airtableClassTableName = 'Class';
const airtableInstructorTableName = 'Instructor';

const webflowApiKey = 'ea0ab0b974aa90c38b6a57a61a880d21292d02c8b89c37816871f995666e1c3e';
const webflowCollectionId = '671a8a02594f9dd273e5f9da';

// CORS Anywhere URL
const corsAnywhere = 'https://cors-anywhere.herokuapp.com/';

// Fetch records from Airtable Class table
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

getAirtableClassRecords();
// Fetch records from Airtable Instructor table
async function getAirtableInstructorRecords() {
  const url = `${corsAnywhere}https://api.airtable.com/v0/${airtableBaseId}/${airtableInstructorTableName}`;
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

function mapInstructors(classRecords, instructorRecords) {
  const instructorMap = instructorRecords.reduce((map, instructor) => {
    map[instructor.id] = instructor.fields; // Create a map of instructor ID to their fields
    return map;
  }, {});

  return classRecords.map(classRecord => {
    const instructors = classRecord.fields.Instructor || [];
    const instructorNames = instructors.map(id => {
      const instructor = instructorMap[id];
      return instructor ? instructor.Name : 'Unknown'; // Check if instructor exists and use 'Name'
    });

    // Log instructor mapping
    console.log('Mapping Instructors for Class Record:', classRecord.fields.Title, instructorNames);

    return {
      ...classRecord,
      fields: {
        ...classRecord.fields,
        InstructorNames: instructorNames, // Add the mapped names
      },
    };
  });
}

// Add a new item to Webflow
async function addWebflowItem(fields) {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items`;
  console.log('Sending data to Webflow:', fields);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json',
        'Origin': 'https://connectmate-new.webflow.io/double-slider',  // Ensure your origin is correct
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        fieldData: { // Ensure 'fieldData' is the correct key
          name: fields.Title || '',
          slug: fields.Title ? fields.Title.toLowerCase().replace(/\s+/g, '-') : '',
          description: fields.Description || '',
          'end-time': String(fields['End time'] || ''),
          'start-time': String(fields['Created time'] || ''),
          location: fields.Location || '',
          'start-date': fields['Start date'] || '',
          'end-date': fields['End date'] || '',
          'instructor-name': (fields.InstructorNames && fields.InstructorNames.length > 0) 
              ? fields.InstructorNames.join(', ') 
              : 'Unknown', // Safely join instructor names
          _archived: false,
          _draft: false,
        },
        live: true, // This ensures the item goes live
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to add item to Webflow:', data);
      return null;
    }

    console.log('Webflow item added:', data);
    return data;
  } catch (error) {
    console.error('Error while sending data to Webflow:', error);
  }
}

// Update an existing item in Webflow
async function updateWebflowItem(webflowId, fields) {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items/${webflowId}`;
  console.log('Updating Webflow item:', fields);

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json',
        'accept-version': '1.0.0',
      },
      body: JSON.stringify({
        fieldData: { // Use 'fieldData' instead of 'fields'
          name: fields.Title || '',
          slug: fields.Title ? fields.Title.toLowerCase().replace(/\s+/g, '-') : '',
          description: fields.Description || '',
          'end-time': String(fields['End time'] || ''),
          'start-time': String(fields['Created time'] || ''),
          location: fields.Location || '',
          'start-date': fields['Start date'] || '',
          'end-date': fields['End date'] || '',
          'instructor-name': fields.InstructorNames.join(', ') || '', // Safely join instructor names
          _archived: false,
          _draft: false,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to update Webflow item:', data);
      return null;
    }

    console.log('Webflow item updated:', data);
    return data;
  } catch (error) {
    console.error('Error while updating data in Webflow:', error);
  }
}

// Delete an item from Webflow
async function deleteWebflowItem(webflowId) {
  const url = `${corsAnywhere}https://api.webflow.com/v2/collections/${webflowCollectionId}/items/${webflowId}`;
  console.log('Deleting Webflow item:', webflowId);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${webflowApiKey}`,
        'accept-version': '1.0.0',
      },
    });

    if (!response.ok) {
      console.error('Failed to delete Webflow item:', response.status, response.statusText);
      return null;
    }

    console.log('Webflow item deleted:', webflowId);
    return webflowId;
  } catch (error) {
    console.error('Error while deleting data in Webflow:', error);
  }
}

// Sync only the latest Airtable data to Webflow
async function syncLatestAirtableToWebflow() {
  const classRecords = await getAirtableClassRecords();
  const instructorRecords = await getAirtableInstructorRecords();
  const webflowRecords = await getWebflowRecords();

  if (!classRecords.length) {
    console.log('No class records found in Airtable.');
    return;
  }

  // Get and map the latest record
  const latestClassRecord = classRecords[0]; // Airtable's latest record is assumed to be at index 0
  const mappedClassRecord = mapInstructors([latestClassRecord], instructorRecords)[0];
  const airtableFields = mappedClassRecord.fields;

  const webflowFields = {
    Title: airtableFields.Title || '',
    Description: airtableFields.Description || '',
    'Start date': airtableFields['Start date'] || '',
    'End date': airtableFields['End date'] || '',
    Location: airtableFields.Location || '',
    'Created time': airtableFields['Created time'] || '',
    'End time': airtableFields['End time'] || '',
    InstructorNames: airtableFields.InstructorNames || [],
    AirtableRecordId: airtableFields.id || '', // Store the Airtable record ID
  };

  // Map Webflow records for easy lookup, including the Airtable Record ID
  const webflowItemMap = webflowRecords.reduce((map, item) => {
    if (item && item.fields && item.fields.AirtableRecordId) {
      map[item.fields.AirtableRecordId] = item;
    }
    return map;
  }, {});

  const existingWebflowItem = webflowItemMap[webflowFields.AirtableRecordId];

  if (existingWebflowItem) {
    console.log('Airtable record already exists in Webflow:', webflowFields.Title);
    
    // Optionally, you could still check for updates
    // Compare each field individually for updates
    const fieldsToCompare = ['Description', 'Start date', 'End date', 'Location', 'Created time', 'End time', 'InstructorNames'];
    const needsUpdate = fieldsToCompare.some(field => {
      const airtableValue = webflowFields[field];
      const webflowValue = existingWebflowItem.fields[field] || '';
      if (airtableValue !== webflowValue) {
        console.log(`Field "${field}" differs. Airtable: ${airtableValue}, Webflow: ${webflowValue}`);
        return true;
      }
      return false;
    });

    if (needsUpdate) {
      console.log('Updating Webflow record:', webflowFields.Title);
      await updateWebflowItem(existingWebflowItem._id, webflowFields);
    } else {
      console.log('No update needed for:', webflowFields.Title);
    }
  } else {
    // If no match found by Airtable ID, add it
    console.log('Adding new latest record to Webflow:', webflowFields.Title);
    await addWebflowItem(webflowFields);
  }
}

// Run the modified sync function
syncLatestAirtableToWebflow();

