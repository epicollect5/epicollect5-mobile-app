import { defineStore } from 'pinia';

export const useBookmarkStore = defineStore('BookmarkStore', {
    state: () => {
        return {
            bookmarkId: null,
            bookmarks: []
        };
    },
    getters: {

    },
    actions: {
        setBookmarks (bookmarks) {
            this.bookmarks = [...bookmarks];
            //natural sort with numeric collation
            this.bookmarks.sort((a, b) => ('' + a.title.toLowerCase()).localeCompare(b.title.toLowerCase(), undefined, { numeric: true }));
        },
        addBookmark (bookmark) {
            this.bookmarks.push(bookmark);
            //natural sort with numeric collation
            this.bookmarks.sort((a, b) => ('' + a.title.toLowerCase()).localeCompare(b.title.toLowerCase(), undefined, { numeric: true }));
        },
        deleteBookmark (bookmarkId) {
            this.bookmarks.forEach((bookmark, index) => {
                if (bookmark.id === bookmarkId) {
                    this.bookmarks.splice(index, 1);
                }
            });
        }
    }
});