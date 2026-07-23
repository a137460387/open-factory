/**
 * Zero-Copy Streaming I/O Utilities
 *
 * Sprint AU: Provides memory-mapped file reading and streaming I/O
 * for large media files. Reduces memory copies and enables efficient
 * processing of video/audio data.
 */

use memmap2::{Mmap, MmapOptions};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

/// Memory-mapped file reader for zero-copy access to large files.
///
/// Instead of reading the entire file into memory, this maps the file
/// directly into the process's address space, allowing the OS to handle
/// paging efficiently.
pub struct MmapReader {
    mmap: Mmap,
    len: usize,
}

impl MmapReader {
    /// Open a file and memory-map it for zero-copy reading.
    pub fn open(path: impl AsRef<Path>) -> std::io::Result<Self> {
        let file = File::open(path.as_ref())?;
        let len = file.metadata()?.len() as usize;

        // SAFETY: We only read from the mmap, never write.
        // The file is kept open for the lifetime of the mmap.
        let mmap = unsafe { MmapOptions::new().map(&file)? };

        Ok(Self { mmap, len })
    }

    /// Get a slice of the mapped memory.
    pub fn slice(&self, offset: usize, len: usize) -> &[u8] {
        let end = (offset + len).min(self.len);
        &self.mmap[offset..end]
    }

    /// Get the entire mapped region.
    pub fn as_bytes(&self) -> &[u8] {
        &self.mmap
    }

    /// Get the file size.
    pub fn len(&self) -> usize {
        self.len
    }

    /// Check if the file is empty.
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
}

/// Streaming chunk reader for processing large files in fixed-size chunks.
///
/// Reads files in chunks without loading the entire file into memory.
/// Useful for waveform extraction, thumbnail generation, and other
/// operations that can process data incrementally.
pub struct ChunkReader {
    reader: BufReader<File>,
    chunk_size: usize,
    offset: u64,
    file_len: u64,
}

impl ChunkReader {
    /// Open a file for chunked reading.
    pub fn open(path: impl AsRef<Path>, chunk_size: usize) -> std::io::Result<Self> {
        let file = File::open(path.as_ref())?;
        let file_len = file.metadata()?.len();
        let reader = BufReader::with_capacity(chunk_size, file);

        Ok(Self {
            reader,
            chunk_size,
            offset: 0,
            file_len,
        })
    }

    /// Read the next chunk. Returns None when EOF is reached.
    pub fn next_chunk(&mut self) -> std::io::Result<Option<Vec<u8>>> {
        if self.offset >= self.file_len {
            return Ok(None);
        }

        let remaining = (self.file_len - self.offset) as usize;
        let to_read = remaining.min(self.chunk_size);
        let mut buf = vec![0u8; to_read];

        self.reader.read_exact(&mut buf)?;
        self.offset += to_read as u64;

        Ok(Some(buf))
    }

    /// Seek to a specific position.
    pub fn seek(&mut self, pos: u64) -> std::io::Result<()> {
        self.reader.seek(SeekFrom::Start(pos))?;
        self.offset = pos;
        Ok(())
    }

    /// Get the current offset.
    pub fn offset(&self) -> u64 {
        self.offset
    }

    /// Get the file length.
    pub fn file_len(&self) -> u64 {
        self.file_len
    }

    /// Get the number of remaining bytes.
    pub fn remaining(&self) -> u64 {
        self.file_len - self.offset
    }
}

/// Ring buffer for streaming audio/video data.
///
/// Provides a fixed-size circular buffer for streaming data,
/// avoiding repeated allocations for ongoing streams.
pub struct RingBuffer {
    data: Vec<u8>,
    capacity: usize,
    write_pos: usize,
    read_pos: usize,
    len: usize,
}

impl RingBuffer {
    /// Create a new ring buffer with the given capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            data: vec![0u8; capacity],
            capacity,
            write_pos: 0,
            read_pos: 0,
            len: 0,
        }
    }

    /// Write data into the ring buffer.
    /// Returns the number of bytes written.
    pub fn write(&mut self, data: &[u8]) -> usize {
        let available = self.capacity - self.len;
        let to_write = data.len().min(available);

        for i in 0..to_write {
            self.data[self.write_pos] = data[i];
            self.write_pos = (self.write_pos + 1) % self.capacity;
        }

        self.len += to_write;
        to_write
    }

    /// Read data from the ring buffer.
    /// Returns the number of bytes read.
    pub fn read(&mut self, buf: &mut [u8]) -> usize {
        let to_read = buf.len().min(self.len);

        for i in 0..to_read {
            buf[i] = self.data[self.read_pos];
            self.read_pos = (self.read_pos + 1) % self.capacity;
        }

        self.len -= to_read;
        to_read
    }

    /// Get the number of bytes available to read.
    pub fn available(&self) -> usize {
        self.len
    }

    /// Get the number of bytes available to write.
    pub fn free_space(&self) -> usize {
        self.capacity - self.len
    }

    /// Check if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Check if the buffer is full.
    pub fn is_full(&self) -> bool {
        self.len == self.capacity
    }

    /// Clear the buffer.
    pub fn clear(&mut self) {
        self.write_pos = 0;
        self.read_pos = 0;
        self.len = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_ring_buffer_basic() {
        let mut rb = RingBuffer::new(16);
        assert!(rb.is_empty());
        assert_eq!(rb.free_space(), 16);

        let written = rb.write(b"hello");
        assert_eq!(written, 5);
        assert_eq!(rb.available(), 5);

        let mut buf = [0u8; 5];
        let read = rb.read(&mut buf);
        assert_eq!(read, 5);
        assert_eq!(&buf, b"hello");
        assert!(rb.is_empty());
    }

    #[test]
    fn test_ring_buffer_wraparound() {
        let mut rb = RingBuffer::new(8);

        rb.write(b"abcdef");
        let mut buf = [0u8; 3];
        rb.read(&mut buf); // Read "abc"

        rb.write(b"ghij"); // Should wrap around
        assert_eq!(rb.available(), 7);

        let mut full = [0u8; 7];
        rb.read(&mut full);
        assert_eq!(&full, b"defghij");
    }

    #[test]
    fn test_chunk_reader() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"Hello, World! This is a test.").unwrap();

        let mut reader = ChunkReader::open(tmp.path(), 10).unwrap();
        assert_eq!(reader.file_len(), 29);

        let chunk1 = reader.next_chunk().unwrap().unwrap();
        assert_eq!(chunk1, b"Hello, Wor");

        let chunk2 = reader.next_chunk().unwrap().unwrap();
        assert_eq!(chunk2, b"ld! This i");

        let chunk3 = reader.next_chunk().unwrap().unwrap();
        assert_eq!(chunk3, b"s a test.");

        assert!(reader.next_chunk().unwrap().is_none());
    }
}
