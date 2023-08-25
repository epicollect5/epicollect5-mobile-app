
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseSelectService } from '@/services/database/database-select-service';

export const bookmarksService = {

    //Check whether a page is bookmarked already 
    getBookmarkId(projectRef, formRef, parentEntryUuid) {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = bookmarkStore.bookmarks;
        let bookmarkId = null;

        bookmarks.forEach((bookmark) => {
            // Check that the project ref and form ref are the same
            if (bookmark.projectRef === projectRef && bookmark.formRef === formRef) {

                // Then check that parent entry uuid is that same as the last object in the 'bookmark' array
                // If the bookmark array is empty, then we are at the top of a navigation
                if (bookmark.hierarchyNavigation.length === 0 ||
                    bookmark.hierarchyNavigation[bookmark.hierarchyNavigation.length - 1].parentEntryUuid === parentEntryUuid) {
                    bookmarkId = bookmark.id;
                }
            }
        });

        return bookmarkId;
    },
    async insertBookmark(projectRef, formRef, title) {

        const rootStore = useRootStore();
        const bookmarkStore = useBookmarkStore();
        // Check if we have a parent entry uuid and retrieve the most recent one
        let parentEntryUuid = '';

        const hierarchyNavigation = rootStore.hierarchyNavigation;
        console.log(JSON.stringify(hierarchyNavigation));

        const lastBookmark = hierarchyNavigation[hierarchyNavigation.length - 1];
        if (lastBookmark) {
            parentEntryUuid = lastBookmark.parentEntryUuid;
        }

        return new Promise((resolve, reject) => {

            databaseInsertService.insertBookmark(projectRef, formRef, title, JSON.stringify(hierarchyNavigation), parentEntryUuid).then(function (res) {

                //update bookmark store
                bookmarkStore.addBookmark({
                    id: res.insertId,
                    projectRef: projectRef,
                    formRef: formRef,
                    title: title,
                    hierarchyNavigation: hierarchyNavigation.slice()
                });
                resolve(res.insertId);
            }, function (error) {
                reject(error);
            });
        });
    },
    async deleteBookmark(bookmarkId) {

        const bookmarkStore = useBookmarkStore();

        return new Promise((resolve, reject) => {
            //delete bookmark from database

            databaseDeleteService.deleteBookmark(bookmarkId).then((res) => {
                //update store
                bookmarkStore.deleteBookmark(bookmarkId);
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    },
    async getBookmarks() {

        const bookmarks = [];

        return new Promise((resolve, reject) => {
            (async function () {
                try {
                    const res = await databaseSelectService.selectBookmarks();

                    // throw new Error('Parameter is not a number!');
                    if (res.rows.length > 0) {
                        for (let i = 0; i < res.rows.length; i++) {
                            const currentRow = res.rows.item(i);
                            bookmarks.push({
                                id: currentRow.id,
                                projectRef: currentRow.project_ref,
                                formRef: currentRow.form_ref,
                                title: currentRow.title,
                                hierarchyNavigation: JSON.parse(currentRow.hierarchy_navigation)
                            });
                        }
                    }
                    resolve(bookmarks);
                }
                catch (error) {
                    console.log(error);
                    reject();
                }
            }());
        });
    },

    //delete all bookmarks of a project
    //used whe deleting a project or all its entries
    async deleteBookmarks(projectRef) {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = bookmarkStore.bookmarks;

        bookmarks.forEach(async (bookmark) => {
            // Check that the project ref and form ref are the same
            if (bookmark.projectRef === projectRef) {
                //delete this bookmark
                await this.deleteBookmark(bookmark.id);
            }
        });
    },
    //delete all bookmarks related to a single entry
    async deleteBookmarksForEntry(entryUuid) {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = bookmarkStore.bookmarks;

        bookmarks.forEach(async (bookmark) => {
            // Check that the project ref and form ref are the same
            bookmark.hierarchyNavigation.forEach(async (obj) => {
                if (obj.parentEntryUuid === entryUuid) {
                    //delete this bookmark
                    await this.deleteBookmark(bookmark.id);
                }
            });
        });
    }
};