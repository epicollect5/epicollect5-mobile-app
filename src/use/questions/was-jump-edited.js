import { PARAMETERS } from '@/config';

export function wasJumpEdited (entryService, params) {

    let wasEdited = false;
    // imp: For  edits:
    // Check if the input has jumps
    // If the answer if different to the previous one
    // we don't show the 'quit' button
    // This is to make sure the user reaches the end of the entry
    // before saving, so the jumps and answers retain their integrity
    if (entryService.action === PARAMETERS.ENTRY_EDIT) {
        if (params.mainInputDetails.jumps.length > 0) {
            if (typeof entryService.entry.answers[params.mainInputDetails.ref] !== 'undefined') {

                const existingAnswer = entryService.entry.answers[params.mainInputDetails.ref].answer;

                switch (params.mainInputDetails.type) {
                    //checkbox and search are array
                    case PARAMETERS.QUESTION_TYPES.CHECKBOX:
                    case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
                    case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE: {
                        //check array equality (order does not matter)
                        wasEdited = !(params.existingAnswer.length === existingAnswer.length && params.existingAnswer.every((answer) => existingAnswer.includes(answer)));
                    }
                        break;
                    default:
                        //check string equality
                        wasEdited = params.existingAnswer !== existingAnswer;
                }
            }
        }
    }
    return wasEdited;
}