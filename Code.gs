function doPost(e) {
  try {
    // Parse JSON safely. If using text/plain for bypass CORS, the content sits in e.postData.contents.
    let postData;
    if (e.postData && e.postData.contents) {
        postData = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
        postData = JSON.parse(e.parameter.data);
    } else {
        throw new Error('No valid post data provided.');
    }
    
    // Allow Origin Headers for proper fetch access if requested (even though text/plain helps)
    if (postData.action === 'registerMember') {
      const result = registerMember(postData.data);
      return ContentService.createTextOutput(JSON.stringify(result))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error('Invalid action');
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    if (!e || !e.parameter || !e.parameter.action) {
      // Default view if visited in browser directly
      return ContentService.createTextOutput("Family Network API is running. Please access via frontend app.")
                           .setMimeType(ContentService.MimeType.TEXT);
    }
    
    const action = e.parameter.action;
    let result = {};
    if (action === 'checkMember') {
      result = checkMember(e.parameter.personId);
    } else if (action === 'getAllMembers') {
      result = getAllMembers();
    } else {
      throw new Error('Invalid action');
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// Configuration Variables
const SHEET_NAME = 'members';
const IMAGE_FOLDER_NAME = 'images';

/**
 * Get or create the 'members' sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers if created new
    sheet.appendRow(['Person_id', 'Name', 'Surname', 'Address', 'Phone', 'Image_URL']);
  }
  return sheet;
}

/**
 * Get or create the 'images' folder in Google Drive
 */
function getFolder() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

/**
 * Check if the 13-digit Person ID exists in the sheet
 * @param {string} personId - The 13 digit ID to check
 * @return {object} - { found: boolean }
 */
function checkMember(personId) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    
    // Start from row 1 (exclude header)
    for (let i = 1; i < data.length; i++) {
        // Enforce string comparison
        if (String(data[i][0]).trim() === String(personId).trim()) {
            return { found: true };
        }
    }
    return { found: false };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Register a new member including uploading image
 * @param {object} data - Form data
 * @return {object} - { success: boolean }
 */
function registerMember(data) {
  try {
    const folder = getFolder();
    let imageUrl = '';
    
    // Extra safety measure
    const check = checkMember(data.personId);
    if (check.found) {
        throw new Error('Member ID already exists. Please login instead.');
    }

    // Process image file
    if (data.imageFile && data.imageName) {
      // Find content type and base64 string
      const contentType = data.imageFile.substring(5, data.imageFile.indexOf(';'));
      const base64Data = data.imageFile.substring(data.imageFile.indexOf('base64,') + 7);
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, data.personId + '_' + data.imageName);
      const file = folder.createFile(blob);
      
      // Allow image to be viewed by anyone with the link
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imageUrl = file.getUrl();
    }

    // Save to Google Sheet
    const sheet = getSheet();
    sheet.appendRow([
      data.personId,
      data.name,
      data.surname,
      data.address,
      data.phone,
      imageUrl
    ]);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get all members from sheet, showing only Name, Surname, Image
 * @return {object} - { success: boolean, members: Array }
 */
function getAllMembers() {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    
    // Return empty if only header exists
    if (data.length <= 1) return { success: true, members: [] };
    
    const headers = data[0];
    const members = [];
    
    // Detect column indexes for safety
    const idName = headers.indexOf('Name') > -1 ? headers.indexOf('Name') : 1;
    const idSurname = headers.indexOf('Surname') > -1 ? headers.indexOf('Surname') : 2;
    const idImage = headers.indexOf('Image_URL') > -1 ? headers.indexOf('Image_URL') : 5;

    for (let i = 1; i < data.length; i++) {
        // Skip empty rows
        if(String(data[i][0]).trim() === "") continue; 
        
        members.push({
            name: data[i][idName],
            surname: data[i][idSurname],
            image: data[i][idImage]
        });
    }
    return { success: true, members: members };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
